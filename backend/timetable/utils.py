import logging
from collections import defaultdict
from .models import (
    Classroom, Faculty, FacultyAssignment, FacultyAvailability,
    Subject, TimeSlot, Timetable, TimetableEntry,
)

logger = logging.getLogger(__name__)
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


class TimetableEngine:

    def __init__(self, timetable):
        self.timetable  = timetable
        self.department = timetable.department
        self.semester   = timetable.semester
        self.global_faculty_busy = set()
        self.global_room_busy    = set()
        self.local_used          = set()
        self.faculty_day_load    = defaultdict(lambda: defaultdict(int))
        self.subject_faculty_map = {}
        self.avail_map           = {}
        # slot_owner_map: timeslot_id -> faculty_id (who claimed this slot first)
        self.slot_owner_map      = {}
        self.timeslots  = []
        self.subjects   = []
        self.classrooms = []
        self.lab_rooms  = []
        self.stats = dict(total=0, theory=0, lab=0, empty=0, force_filled=0)

    def initialize(self):
        all_ts = list(TimeSlot.objects.all().order_by("day", "slot_number"))
        self.timeslots = [t for t in all_ts if not t.is_break]
        if not self.timeslots:
            return False
        self.subjects = list(Subject.objects.filter(
            department=self.department, semester=self.semester))
        if not self.subjects:
            return False
        self.classrooms = list(Classroom.objects.filter(is_lab=False))
        self.lab_rooms  = list(Classroom.objects.filter(is_lab=True))
        if not self.classrooms and not self.lab_rooms:
            return False
        self._build_subject_faculty_map()
        self._build_avail_map()
        self._build_slot_owner_map()
        self._build_global_occupancy()
        return True

    def _build_subject_faculty_map(self):
        assignments = FacultyAssignment.objects.filter(
            department=self.department, semester=self.semester
        ).prefetch_related("subjects", "faculty__user")
        for assignment in assignments:
            for subject in assignment.subjects.all():
                if subject.id not in self.subject_faculty_map:
                    self.subject_faculty_map[subject.id] = assignment.faculty
        for subject in self.subjects:
            if subject.id not in self.subject_faculty_map:
                fac = Faculty.objects.filter(subjects=subject).first()
                if fac:
                    self.subject_faculty_map[subject.id] = fac

    def _build_avail_map(self):
        all_fids = {
            self.subject_faculty_map[s.id].id
            for s in self.subjects if s.id in self.subject_faculty_map
        }
        ts_ids = {t.id for t in self.timeslots}
        # Filter by dept+sem so availability is scoped correctly
        records = FacultyAvailability.objects.filter(
            faculty_id__in=all_fids,
            timeslot__in=self.timeslots,
            department=self.department,
            semester=self.semester,
        ).values("faculty_id", "timeslot_id", "is_available")
        rec_map = defaultdict(dict)
        for r in records:
            rec_map[r["faculty_id"]][r["timeslot_id"]] = r["is_available"]
        for fid in all_fids:
            if fid not in rec_map:
                self.avail_map[fid] = set(ts_ids)
            else:
                self.avail_map[fid] = {
                    tid for tid in ts_ids if rec_map[fid].get(tid, True)
                }

    def _build_slot_owner_map(self):
        """
        Build timeslot_id -> faculty_id map from FacultyAvailability.
        The first faculty (by id) who marked a slot available owns that slot.
        This is the slot ownership shown in the 'All Faculty overview'.
        """
        fa_ids = set(FacultyAssignment.objects.filter(
            department=self.department, semester=self.semester
        ).values_list('faculty_id', flat=True))
        legacy_ids = set(Faculty.objects.filter(
            department=self.department, semester=self.semester
        ).values_list('id', flat=True))
        faculty_ids = fa_ids | legacy_ids

        records = (
            FacultyAvailability.objects
            .filter(
                faculty_id__in=faculty_ids,
                is_available=True,
                timeslot__in=self.timeslots,
                department=self.department,
                semester=self.semester,
            )
            .order_by('id')
            .values('timeslot_id', 'faculty_id')
        )
        for r in records:
            tid = r['timeslot_id']
            if tid not in self.slot_owner_map:
                self.slot_owner_map[tid] = r['faculty_id']

    def _build_global_occupancy(self):
        # Global occupancy is intentionally empty.
        # Each department's timetable is independent — a faculty can teach
        # the same timeslot in different departments (different sections/rooms).
        # The only conflict that matters is within a single timetable.
        pass

    def _fac_available(self, fid, ts):
        return ts.id in self.avail_map.get(fid, set())

    def _fac_globally_free(self, fid, ts):
        # No global conflict check — departments are independent
        return True

    def _room_free(self, rid, ts):
        # Only check within this timetable (local room conflicts)
        return (rid, ts.day, ts.slot_number) not in self.global_room_busy

    def _pick_room(self, slots, is_lab):
        primary  = self.lab_rooms  if is_lab else self.classrooms
        fallback = self.classrooms if is_lab else self.lab_rooms
        for pool in (primary, fallback):
            for room in pool:
                if all(self._room_free(room.id, ts) for ts in slots):
                    return room
        # All rooms used in this timetable — reuse any available room
        all_rooms = primary or fallback
        return all_rooms[0] if all_rooms else None

    def _mark(self, fid, rid, slots):
        for ts in slots:
            self.global_faculty_busy.add((fid, ts.day, ts.slot_number))
            self.global_room_busy.add((rid, ts.day, ts.slot_number))
            self.local_used.add(ts.id)
            self.faculty_day_load[fid][ts.day] += 1

    def _assign_theory(self, subject, ts):
        if ts.id in self.local_used:
            return False

        faculty = self.subject_faculty_map.get(subject.id)
        if not faculty:
            return False
        fid = faculty.id

        # The slot owner is the faculty explicitly assigned to this slot in the
        # availability grid. Only the owner should teach in their slot.
        owner_fid = self.slot_owner_map.get(ts.id)
        if owner_fid is not None and owner_fid != fid:
            return False  # This slot belongs to a different faculty

        if not self._fac_available(fid, ts):
            return False

        room = self._pick_room([ts], is_lab=False)
        if not room:
            return False

        TimetableEntry.objects.create(
            timetable=self.timetable, timeslot=ts,
            subject=subject, faculty=faculty, classroom=room, is_lab_slot=False,
        )
        self._mark(fid, room.id, [ts])
        self.stats["total"]  += 1
        self.stats["theory"] += 1
        return True

    def _assign_lab(self, subject, ts1, ts2, pair_id):
        if ts1.id in self.local_used or ts2.id in self.local_used:
            return False
        faculty = self.subject_faculty_map.get(subject.id)
        if not faculty:
            return False
        fid = faculty.id
        # Both slots must be owned by this faculty (or have no owner)
        for ts in (ts1, ts2):
            owner_fid = self.slot_owner_map.get(ts.id)
            if owner_fid is not None and owner_fid != fid:
                return False
            if not self._fac_available(fid, ts):
                return False
        room = self._pick_room([ts1, ts2], is_lab=True)
        if not room:
            return False
        TimetableEntry.objects.create(
            timetable=self.timetable, timeslot=ts1, subject=subject,
            faculty=faculty, classroom=room, is_lab_slot=True, lab_pair_id=pair_id,
        )
        TimetableEntry.objects.create(
            timetable=self.timetable, timeslot=ts2, subject=subject,
            faculty=faculty, classroom=room, is_lab_slot=True, lab_pair_id=pair_id,
        )
        self._mark(fid, room.id, [ts1, ts2])
        self.stats["total"] += 2
        self.stats["lab"]   += 2
        return True

    def _pass_labs(self):
        lab_subjects = [s for s in self.subjects if s.is_lab]
        pair_id = 2000
        day_slots = defaultdict(list)
        for ts in self.timeslots:
            day_slots[ts.day].append(ts)
        for d in day_slots:
            day_slots[d].sort(key=lambda x: x.slot_number)
        for subject in lab_subjects:
            assigned = False
            for day in DAYS:
                if assigned:
                    break
                sl = day_slots.get(day, [])
                pairs = [
                    (sl[i], sl[i+1]) for i in range(len(sl)-1)
                    if sl[i+1].slot_number == sl[i].slot_number + 1
                ]
                for ts1, ts2 in pairs:
                    if self._assign_lab(subject, ts1, ts2, pair_id):
                        pair_id += 1
                        assigned = True
                        break

    def _pass_theory(self):
        theory_subjects = [s for s in self.subjects if not s.is_lab]
        if not theory_subjects:
            return
        day_slots = defaultdict(list)
        for ts in self.timeslots:
            day_slots[ts.day].append(ts)
        for d in day_slots:
            day_slots[d].sort(key=lambda x: x.slot_number)

        # Build reverse map: faculty_id -> list of subjects they teach
        faculty_subjects = defaultdict(list)
        for subject in theory_subjects:
            fac = self.subject_faculty_map.get(subject.id)
            if fac:
                faculty_subjects[fac.id].append(subject)

        subject_count = defaultdict(int)
        for day in DAYS:
            for ts in day_slots.get(day, []):
                if ts.id in self.local_used:
                    continue
                # Find the faculty who owns this slot and pick their least-assigned subject
                owner_fid = self.slot_owner_map.get(ts.id)
                if owner_fid is not None:
                    candidates = sorted(
                        faculty_subjects.get(owner_fid, []),
                        key=lambda s: subject_count[s.id]
                    )
                    for subject in candidates:
                        if self._assign_theory(subject, ts):
                            subject_count[subject.id] += 1
                            break
                else:
                    # No owner assigned — fall back to any available faculty
                    candidates = sorted(theory_subjects, key=lambda s: subject_count[s.id])
                    for subject in candidates:
                        if self._assign_theory(subject, ts):
                            subject_count[subject.id] += 1
                            break

    def generate(self):
        if not self.initialize():
            return {
                "success": False,
                "error": "Initialization failed. Check subjects, faculty assignments, and classrooms.",
                **self.stats,
            }
        self._pass_labs()
        self._pass_theory()
        self.stats["empty"]        = len(self.timeslots) - len(self.local_used)
        self.stats["force_filled"] = 0
        empty = self.stats["empty"]
        if empty > 0:
            msg = "Timetable generated. " + str(empty) + " slot(s) empty."
        else:
            msg = "Timetable generated successfully."
        return {"success": self.stats["total"] > 0, "message": msg, **self.stats}


def generate_timetable_auto(timetable):
    return TimetableEngine(timetable).generate()

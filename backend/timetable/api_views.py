from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

from timetable.models import (
    Department, Subject, Faculty, FacultyAssignment, Classroom, TimeSlot,
    FacultyAvailability, Timetable, TimetableEntry, UserProfile
)
from timetable.serializers import (
    DepartmentSerializer, SubjectSerializer, FacultySerializer,
    ClassroomSerializer, TimeSlotSerializer, FacultyAvailabilitySerializer,
    TimetableSerializer, TimetableEntrySerializer
)
from timetable.utils import generate_timetable_auto


def _get_role(user):
    try:
        return user.userprofile.role
    except UserProfile.DoesNotExist:
        return 'admin' if user.is_superuser else 'student'


@api_view(['POST'])
@permission_classes([AllowAny])
def login_api(request):
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')
    requested_role = request.data.get('role', '').lower()

    # look up user by email
    try:
        user_obj = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return Response({'error': 'Invalid email or password'}, status=400)

    user = authenticate(username=user_obj.username, password=password)
    if not user:
        return Response({'error': 'Invalid email or password'}, status=400)

    role = _get_role(user)

    # enforce role match
    if requested_role and role != requested_role:
        return Response(
            {'error': f'This account is registered as "{role}", not "{requested_role}".'},
            status=403
        )

    # admin login is restricted to the designated admin email only
    ADMIN_EMAIL = 'thepreethu01@gmail.com'
    if role == 'admin' and user.email.lower() != ADMIN_EMAIL:
        return Response({'error': 'Access denied.'}, status=403)

    token, _ = Token.objects.get_or_create(user=user)
    user_data = {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'full_name': user.get_full_name() or user.username,
        'role': role,
    }
    if role == 'faculty':
        fac = Faculty.objects.filter(user=user).first()
        if fac:
            user_data['faculty_id'] = fac.id
            user_data['employee_id'] = fac.employee_id
    return Response({'token': token.key, 'user': user_data})


@api_view(['POST'])
@permission_classes([AllowAny])
def register_admin_api(request):
    """One-time admin self-registration. Only allowed if no admin exists yet."""
    if User.objects.filter(is_superuser=True).exists():
        return Response({'error': 'An admin account already exists. Contact the existing admin.'}, status=403)

    name = request.data.get('name', '').strip()
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')

    if not name or not email or not password:
        return Response({'error': 'Name, email and password are required.'}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'Email already in use.'}, status=400)

    username = email.split('@')[0]
    base = username
    i = 1
    while User.objects.filter(username=username).exists():
        username = f"{base}{i}"; i += 1

    parts = name.split(' ', 1)
    user = User.objects.create_superuser(
        username=username,
        email=email,
        password=password,
        first_name=parts[0],
        last_name=parts[1] if len(parts) > 1 else '',
    )
    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'user': {'id': user.id, 'username': user.username, 'email': user.email,
                 'full_name': user.get_full_name(), 'role': 'admin'}
    }, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_user_api(request):
    """Admin or HOD creates HOD / Faculty / Student accounts."""
    caller_role = _get_role(request.user)
    if caller_role not in ('admin', 'hod'):
        return Response({'error': 'Only admins or HODs can create user accounts.'}, status=403)

    name = request.data.get('name', '').strip()
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')
    role = request.data.get('role', '').lower()

    # HOD can only create faculty accounts
    if caller_role == 'hod' and role != 'faculty':
        return Response({'error': 'HODs can only create faculty accounts.'}, status=403)

    if not all([name, email, password, role]):
        return Response({'error': 'name, email, password and role are required.'}, status=400)
    if role not in ('hod', 'faculty', 'student'):
        return Response({'error': 'Role must be hod, faculty, or student.'}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return Response({'error': 'Email already in use.'}, status=400)

    username = email.split('@')[0]
    base = username; i = 1
    while User.objects.filter(username=username).exists():
        username = f"{base}{i}"; i += 1

    parts = name.split(' ', 1)
    user = User.objects.create_user(
        username=username, email=email, password=password,
        first_name=parts[0], last_name=parts[1] if len(parts) > 1 else '',
    )
    UserProfile.objects.create(user=user, role=role)

    # Auto-create Faculty record so they appear in Faculty Availability
    if role == 'faculty':
        dept_id = request.data.get('department')
        dept = Department.objects.filter(id=dept_id).first() or Department.objects.first()
        emp_id = f"FAC{user.id:04d}"
        semester = request.data.get('semester')
        faculty_obj = Faculty.objects.create(
            user=user, department=dept, employee_id=emp_id,
            semester=int(semester) if semester else None
        )
        subject_ids = request.data.get('subject_ids', [])
        if subject_ids:
            faculty_obj.subjects.set(Subject.objects.filter(id__in=subject_ids))

        # Create FacultyAssignment records for multi-dept/sem support
        assignments = request.data.get('assignments', [])
        for a in assignments:
            a_dept = Department.objects.filter(id=a.get('department')).first()
            a_sem  = a.get('semester')
            a_subs = a.get('subject_ids', [])
            if a_dept and a_sem:
                fa, _ = FacultyAssignment.objects.get_or_create(
                    faculty=faculty_obj, department=a_dept, semester=int(a_sem)
                )
                if a_subs:
                    fa.subjects.set(Subject.objects.filter(id__in=a_subs))

    return Response({
        'id': user.id, 'username': user.username, 'email': user.email,
        'full_name': user.get_full_name(), 'role': role
    }, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_users_api(request):
    """Admin or HOD lists users. HOD only sees faculty."""
    caller_role = _get_role(request.user)
    if caller_role not in ('admin', 'hod'):
        return Response({'error': 'Forbidden'}, status=403)
    profiles = UserProfile.objects.select_related('user').all()
    # HOD only sees faculty
    if caller_role == 'hod':
        profiles = profiles.filter(role='faculty')
    data = []
    for p in profiles:
        entry = {
            'id': p.user.id,
            'name': p.user.get_full_name() or p.user.username,
            'email': p.user.email,
            'role': p.role,
            'department': '',
            'semester': None,
            'subjects': [],
        }
        if p.role == 'faculty':
            f = Faculty.objects.filter(user=p.user).select_related('department').prefetch_related('subjects', 'assignments__department', 'assignments__subjects').first()
            if f:
                entry['faculty_id'] = f.id
                entry['department'] = f.department.name if f.department else ''
                entry['semester'] = f.semester
                entry['subjects'] = [{'id': s.id, 'code': s.code, 'name': s.name, 'semester': s.semester} for s in f.subjects.all()]
                entry['assignments'] = [
                    {
                        'id': a.id,
                        'department': a.department.id,
                        'department_name': a.department.name,
                        'semester': a.semester,
                        'subject_ids': [s.id for s in a.subjects.all()],
                        'subjects': [{'id': s.id, 'code': s.code, 'name': s.name} for s in a.subjects.all()],
                    }
                    for a in f.assignments.all()
                ]
        data.append(entry)
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_faculty_users_api(request):
    """Return faculty users filtered by department+semester using FacultyAssignment.
    Supports ?department=<id>&semester=<int> filters."""
    qs = Faculty.objects.select_related('user', 'department').prefetch_related(
        'subjects', 'assignments__department', 'assignments__subjects'
    )

    dept_id  = request.query_params.get('department')
    semester = request.query_params.get('semester')

    if dept_id and semester:
        # Match faculty who have a FacultyAssignment for this dept+sem
        # OR faculty whose legacy faculty.semester matches (for accounts without assignments yet)
        try:
            sem_int = int(semester)
            from django.db.models import Q
            qs = qs.filter(
                Q(assignments__department_id=dept_id, assignments__semester=sem_int) |
                Q(assignments__isnull=True, semester=sem_int, department_id=dept_id)
            ).distinct()
        except (ValueError, TypeError):
            pass
    elif dept_id:
        qs = qs.filter(
            Q(assignments__department_id=dept_id) |
            Q(assignments__isnull=True, department_id=dept_id)
        ).distinct()
    elif semester:
        try:
            sem_int = int(semester)
            qs = qs.filter(
                Q(assignments__semester=sem_int) |
                Q(assignments__isnull=True, semester=sem_int)
            ).distinct()
        except (ValueError, TypeError):
            pass

    data = []
    for faculty_obj in qs:
        # Get subjects for the requested dept+sem assignment
        subjects_for_filter = []
        if dept_id and semester:
            try:
                sem_int = int(semester)
                # Try FacultyAssignment first
                assignment = faculty_obj.assignments.filter(
                    department_id=dept_id, semester=sem_int
                ).prefetch_related('subjects').first()
                if assignment:
                    subjects_for_filter = [
                        {'id': s.id, 'code': s.code, 'name': s.name, 'semester': s.semester}
                        for s in assignment.subjects.all()
                    ]
                else:
                    # Fallback: legacy Faculty.subjects filtered by dept+sem
                    subjects_for_filter = [
                        {'id': s.id, 'code': s.code, 'name': s.name, 'semester': s.semester}
                        for s in faculty_obj.subjects.filter(department_id=dept_id, semester=sem_int)
                    ]
            except (ValueError, TypeError):
                pass

        data.append({
            'id': faculty_obj.id,
            'user_id': faculty_obj.user.id,
            'full_name': faculty_obj.user.get_full_name() or faculty_obj.user.username,
            'email': faculty_obj.user.email,
            'department_name': faculty_obj.department.name if faculty_obj.department else '',
            'department_id': faculty_obj.department.id if faculty_obj.department else None,
            'semester': faculty_obj.semester,
            'subjects': subjects_for_filter,
            'assignments': [
                {
                    'id': a.id,
                    'department': a.department.id,
                    'department_name': a.department.name,
                    'semester': a.semester,
                    'subjects': [{'id': s.id, 'code': s.code, 'name': s.name} for s in a.subjects.all()],
                }
                for a in faculty_obj.assignments.all()
            ],
        })
    return Response(data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_user_api(request, user_id):
    caller_role = _get_role(request.user)
    if caller_role not in ('admin', 'hod'):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        user = User.objects.get(id=user_id, is_superuser=False)
        # HOD can only delete faculty
        if caller_role == 'hod':
            profile = UserProfile.objects.filter(user=user).first()
            if not profile or profile.role != 'faculty':
                return Response({'error': 'HODs can only delete faculty accounts.'}, status=403)
        user.delete()
        return Response({'message': 'User deleted'})
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def edit_user_api(request, user_id):
    caller_role = _get_role(request.user)
    if caller_role not in ('admin', 'hod'):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        user = User.objects.get(id=user_id, is_superuser=False)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

    # HOD can only edit faculty
    if caller_role == 'hod':
        profile_check = UserProfile.objects.filter(user=user).first()
        if not profile_check or profile_check.role != 'faculty':
            return Response({'error': 'HODs can only edit faculty accounts.'}, status=403)

    name = request.data.get('name', '').strip()
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '').strip()

    if name:
        parts = name.split(' ', 1)
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else ''
    if email and email != user.email:
        if User.objects.filter(email__iexact=email).exclude(id=user_id).exists():
            return Response({'error': 'Email already in use.'}, status=400)
        user.email = email
    if password:
        user.set_password(password)
    user.save()

    # Update faculty-specific fields
    profile = UserProfile.objects.filter(user=user).first()
    if profile and profile.role == 'faculty':
        dept_id     = request.data.get('department')
        subject_ids = request.data.get('subject_ids', [])
        semester    = request.data.get('semester')
        assignments = request.data.get('assignments', [])
        faculty_obj = Faculty.objects.filter(user=user).first()
        if faculty_obj:
            if dept_id:
                dept = Department.objects.filter(id=dept_id).first()
                if dept:
                    faculty_obj.department = dept
            if semester is not None:
                faculty_obj.semester = int(semester) if semester else None
            faculty_obj.save()
            if subject_ids is not None:
                faculty_obj.subjects.set(Subject.objects.filter(id__in=subject_ids))

            # Sync FacultyAssignment records — always replace if assignments key is present
            if 'assignments' in request.data:
                faculty_obj.assignments.all().delete()
                for a in assignments:
                    a_dept = Department.objects.filter(id=a.get('department')).first()
                    a_sem  = a.get('semester')
                    a_subs = a.get('subject_ids', [])
                    if a_dept and a_sem:
                        try:
                            fa = FacultyAssignment.objects.create(
                                faculty=faculty_obj, department=a_dept, semester=int(a_sem)
                            )
                            if a_subs:
                                fa.subjects.set(Subject.objects.filter(id__in=a_subs))
                        except Exception:
                            # Assignment already exists (race condition), update it
                            fa = FacultyAssignment.objects.filter(
                                faculty=faculty_obj, department=a_dept, semester=int(a_sem)
                            ).first()
                            if fa and a_subs:
                                fa.subjects.set(Subject.objects.filter(id__in=a_subs))

    return Response({'message': 'Updated successfully'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def faculty_workload(request):
    """Return period count per faculty for a given department and optional semester."""
    dept_id = request.query_params.get('department')
    sem     = request.query_params.get('semester')

    qs = TimetableEntry.objects.select_related('faculty__user', 'timetable').filter(
        timetable__is_active=True
    )
    if dept_id:
        qs = qs.filter(timetable__department_id=dept_id)
    if sem:
        qs = qs.filter(timetable__semester=sem)

    workload = {}
    for entry in qs:
        fid = entry.faculty.id
        if fid not in workload:
            workload[fid] = {
                'faculty_id': fid,
                'name': entry.faculty.user.get_full_name() or entry.faculty.user.username,
                'employee_id': entry.faculty.employee_id,
                'periods': 0,
            }
        workload[fid]['periods'] += 1

    return Response(sorted(workload.values(), key=lambda x: -x['periods']))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def faculty_assignments(request):
    """
    GLOBAL BUSY CHECK for a specific faculty.

    Returns every timeslot where faculty_id is assigned in ANY active timetable.
    Optional ?exclude_department + ?exclude_semester lets the caller omit the
    timetable currently being edited (so those slots stay editable).

    Single source of truth: TimetableEntry.
    Never filters by department/semester except for the explicit exclusion.
    """
    import logging
    logger = logging.getLogger(__name__)

    faculty_id      = request.query_params.get('faculty')
    exclude_dept    = request.query_params.get('exclude_department')
    exclude_sem     = request.query_params.get('exclude_semester')

    if not faculty_id:
        return Response([])

    # ── GLOBAL query: ALL active timetables, THIS faculty only ───────────────
    qs = (
        TimetableEntry.objects
        .filter(faculty_id=faculty_id, timetable__is_active=True)
        .select_related('timeslot', 'timetable__department')
    )

    if exclude_dept and exclude_sem:
        try:
            qs = qs.exclude(
                timetable__department_id=int(exclude_dept),
                timetable__semester=int(exclude_sem),
            )
        except (ValueError, TypeError):
            pass

    # De-duplicate by timeslot_id (a lab pair occupies the same slot twice)
    seen: set = set()
    data = []
    for e in qs:
        if e.timeslot_id not in seen:
            seen.add(e.timeslot_id)
            data.append({
                'timeslot_id':     e.timeslot_id,
                'day':             e.timeslot.day,
                'slot_number':     e.timeslot.slot_number,
                'department_name': e.timetable.department.name,
                'semester':        e.timetable.semester,
            })

    logger.info(
        "[faculty_assignments] faculty=%s total_entries=%d unique_slots=%d excluded_dept=%s excluded_sem=%s",
        faculty_id, qs.count(), len(data), exclude_dept, exclude_sem,
    )
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dept_slot_assignments(request):
    """
    Returns timeslot_id -> {faculty_name, faculty_id} for slots already claimed
    by any faculty in this dept+sem via FacultyAvailability.
    One slot can only be claimed by ONE faculty per dept+sem.
    First faculty to save wins that slot.
    """
    dept_id  = request.query_params.get('department')
    semester = request.query_params.get('semester')
    if not dept_id or not semester:
        return Response({})

    try:
        sem_int = int(semester)
    except (ValueError, TypeError):
        return Response({})

    # Get all faculty in this dept+sem
    fa_ids = set(FacultyAssignment.objects.filter(
        department_id=dept_id, semester=sem_int,
    ).values_list('faculty_id', flat=True))
    legacy_ids = set(Faculty.objects.filter(
        department_id=dept_id, semester=sem_int,
    ).values_list('id', flat=True))
    faculty_ids = fa_ids | legacy_ids

    if not faculty_ids:
        return Response({})

    # Get all available slots for these faculty — filtered by THIS dept+sem, first record per timeslot wins
    avail_records = FacultyAvailability.objects.filter(
        faculty_id__in=faculty_ids,
        is_available=True,
        department_id=dept_id,
        semester=sem_int,
    ).select_related('faculty__user').order_by('id')  # earliest save wins

    # One slot -> one faculty (first one saved)
    data = {}
    for a in avail_records:
        slot_id = str(a.timeslot_id)
        if slot_id not in data:
            data[slot_id] = {
                'faculty_id':   a.faculty_id,
                'faculty_name': a.faculty.user.get_full_name() or a.faculty.user.username,
            }

    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def all_faculty_availability(request):
    """
    Returns a map of timeslot_id -> list of {faculty_id, faculty_name} for slots
    that are marked available.
    Supports optional ?semester=<int> to restrict to faculty of that semester only.
    """
    semester = request.query_params.get('semester')

    qs = FacultyAvailability.objects.filter(is_available=True).select_related('faculty__user', 'timeslot')

    # If semester provided, restrict to faculty belonging to that semester
    # (by faculty.semester field OR by having subjects in that semester)
    if semester:
        try:
            sem_int = int(semester)
            qs = qs.filter(
                Q(faculty__semester=sem_int) |
                Q(faculty__subjects__semester=sem_int)
            ).distinct()
        except (ValueError, TypeError):
            pass

    data = {}
    for a in qs:
        slot_id = str(a.timeslot.id)
        faculty_name = a.faculty.user.get_full_name() or a.faculty.user.username
        if slot_id not in data:
            data[slot_id] = []
        # Avoid duplicates from the distinct() join
        if not any(x['faculty_id'] == a.faculty.id for x in data[slot_id]):
            data[slot_id].append({'faculty_id': a.faculty.id, 'faculty_name': faculty_name})
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def timeslot_occupancy_api(request):
    """Return list of faculty IDs occupied in a specific timeslot across all active timetables."""
    slot_id = request.query_params.get('timeslot_id')
    if not slot_id:
        return Response([])
    
    occupied_fids = TimetableEntry.objects.filter(
        timeslot_id=slot_id,
        timetable__is_active=True
    ).values_list('faculty_id', flat=True)
    
    return Response(list(set(occupied_fids)))


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_exists_api(request):
    return Response({'exists': User.objects.filter(is_superuser=True).exists()})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_api(request):
    request.user.auth_token.delete()
    return Response({'message': 'Logged out'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    role = _get_role(user)
    data = {
        'id': user.id, 'username': user.username, 'email': user.email,
        'full_name': user.get_full_name() or user.username, 'role': role
    }
    if role == 'faculty':
        fac = Faculty.objects.filter(user=user).first()
        if fac:
            data['faculty_id'] = fac.id
            data['employee_id'] = fac.employee_id
    return Response(data)


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]


class SubjectViewSet(viewsets.ModelViewSet):
    queryset = Subject.objects.select_related('department').all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        dept = self.request.query_params.get('department')
        sem  = self.request.query_params.get('semester')
        exclude_faculty = self.request.query_params.get('exclude_faculty')

        if dept:
            qs = qs.filter(department_id=dept)
        if sem:
            qs = qs.filter(semester=sem)

        # Exclude subjects already assigned to OTHER faculty for this dept+sem
        # (subjects assigned to the current faculty being edited are still shown)
        if exclude_faculty and dept and sem:
            try:
                taken_ids = FacultyAssignment.objects.filter(
                    department_id=dept, semester=int(sem)
                ).exclude(
                    faculty_id=int(exclude_faculty)
                ).values_list('subjects__id', flat=True)
                # Also check legacy Faculty.subjects M2M
                from django.db.models import Q
                legacy_taken = Faculty.objects.filter(
                    subjects__department_id=dept,
                    subjects__semester=int(sem)
                ).exclude(id=int(exclude_faculty)).values_list('subjects__id', flat=True)
                all_taken = set(list(taken_ids) + list(legacy_taken)) - {None}
                qs = qs.exclude(id__in=all_taken)
            except (ValueError, TypeError):
                pass

        return qs


class FacultyViewSet(viewsets.ModelViewSet):
    queryset = Faculty.objects.select_related('user', 'department').all()
    serializer_class = FacultySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        dept = self.request.query_params.get('department')
        sem = self.request.query_params.get('semester')
        if dept:
            qs = qs.filter(department_id=dept)
        if sem:
            qs = qs.filter(semester=sem)
        return qs


class ClassroomViewSet(viewsets.ModelViewSet):
    queryset = Classroom.objects.all()
    serializer_class = ClassroomSerializer
    permission_classes = [IsAuthenticated]


class TimeSlotViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TimeSlot.objects.all().order_by('day', 'slot_number')
    serializer_class = TimeSlotSerializer
    permission_classes = [IsAuthenticated]


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def faculty_availability(request):
    """
    GET  ?faculty=<id>  → return saved availability records for that faculty.
    POST { faculty, slots:[{timeslot_id, is_available}] }
         → atomically replace all records for that faculty.

    Single source of truth: FacultyAvailability table.
    Strict faculty-ID filtering — never leaks another faculty's data.
    """
    import logging
    from django.db import transaction
    logger = logging.getLogger(__name__)

    if request.method == 'GET':
        faculty_id = request.query_params.get('faculty')
        department_id = request.query_params.get('department')
        semester = request.query_params.get('semester')
        if not faculty_id:
            return Response([])
        qs = FacultyAvailability.objects.filter(faculty_id=faculty_id)
        # Filter by dept+sem if provided — availability is scoped per dept+sem
        if department_id and semester:
            qs = qs.filter(department_id=department_id, semester=semester)
        logger.info("[faculty_availability GET] faculty=%s dept=%s sem=%s records=%d",
                    faculty_id, department_id, semester, qs.count())
        return Response(FacultyAvailabilitySerializer(qs, many=True).data)

    # ── POST ─────────────────────────────────────────────────────────────────
    faculty_id    = request.data.get('faculty')
    department_id = request.data.get('department')
    semester      = request.data.get('semester')
    slots_data    = request.data.get('slots', [])

    if not faculty_id:
        return Response({'error': 'Faculty ID is required.'}, status=400)
    if not department_id or not semester:
        return Response({'error': 'Department and semester are required.'}, status=400)

    available = [s for s in slots_data if s.get('is_available')]
    if not available:
        return Response(
            {'error': 'Please select at least one available slot before saving.'},
            status=400,
        )

    try:
        with transaction.atomic():
            # Delete only records for THIS faculty + THIS dept + THIS semester
            FacultyAvailability.objects.filter(
                faculty_id=faculty_id,
                department_id=department_id,
                semester=semester,
            ).delete()
            FacultyAvailability.objects.bulk_create([
                FacultyAvailability(
                    faculty_id=faculty_id,
                    timeslot_id=s['timeslot_id'],
                    is_available=s['is_available'],
                    department_id=department_id,
                    semester=semester,
                )
                for s in slots_data
            ])
        logger.info(
            "[faculty_availability POST] faculty=%s dept=%s sem=%s saved=%d available=%d",
            faculty_id, department_id, semester, len(slots_data), len(available),
        )
    except Exception as exc:
        logger.exception("[faculty_availability POST] faculty=%s error=%s", faculty_id, exc)
        return Response({'error': f'Save failed: {exc}'}, status=500)

    return Response({'message': 'Availability saved successfully'})


class TimetableViewSet(viewsets.ModelViewSet):
    queryset = Timetable.objects.select_related('department').prefetch_related('entries').all()
    serializer_class = TimetableSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        dept = self.request.query_params.get('department')
        sem = self.request.query_params.get('semester')
        active = self.request.query_params.get('active')
        if dept:
            qs = qs.filter(department_id=dept)
        if sem:
            qs = qs.filter(semester=sem)
        if active:
            qs = qs.filter(is_active=True)
        return qs

    @action(detail=False, methods=['post'])
    def generate(self, request):
        dept_id = request.data.get('department')
        sem = request.data.get('semester')
        year = request.data.get('academic_year', '2024-25')
        
        # Delete old timetables and their entries for this dept/sem
        old = Timetable.objects.filter(department_id=dept_id, semester=sem)
        for tt in old:
            tt.entries.all().delete()
        old.delete()
        
        # Create new timetable
        tt = Timetable.objects.create(department_id=dept_id, semester=sem, academic_year=year)
        
        # Generate timetable using the new engine
        result = generate_timetable_auto(tt)
        
        if result and result.get('success'):
            data = TimetableSerializer(tt).data
            data['_stats'] = {
                'total': result.get('total', 0),
                'theory': result.get('theory', 0),
                'lab': result.get('lab', 0),
                'empty': result.get('empty', 0),
                'force_filled': result.get('force_filled', 0),
                'message': result.get('message', 'Timetable generated successfully.')
            }
            return Response(data, status=201)
        
        # If generation failed, delete the timetable and return error
        tt.delete()
        error_msg = result.get('error', 'Could not generate. Check subjects, faculty availability, and classrooms.')
        return Response({'error': error_msg}, status=400)

    @action(detail=False, methods=['post'])
    def generate_all(self, request):
        """
        Generate timetables for ALL department+semester combinations sequentially.
        Each timetable uses slot ownership (FacultyAvailability) to assign the
        correct faculty per slot. Shared faculty are handled via global conflict checks.
        """
        from django.db.models import Count
        import logging
        logger = logging.getLogger(__name__)

        year = request.data.get('academic_year', '2024-25')

        pairs = list(
            Subject.objects
            .values('department_id', 'semester', 'department__name')
            .annotate(cnt=Count('id'))
            .order_by('department__name', 'semester')
        )

        if not pairs:
            return Response({'error': 'No subjects found.'}, status=400)

        # Delete ALL existing timetables — clean slate
        Timetable.objects.filter(is_active=True).delete()

        results = []

        for p in pairs:
            tt = Timetable.objects.create(
                department_id=p['department_id'],
                semester=p['semester'],
                academic_year=year,
            )
            result = generate_timetable_auto(tt)
            if result and result.get('success'):
                results.append({
                    'department_id':   tt.department_id,
                    'department_name': p['department__name'],
                    'semester':        tt.semester,
                    'timetable_id':    tt.id,
                    'success':         True,
                    'total':           result.get('total', 0),
                    'theory':          result.get('theory', 0),
                    'lab':             result.get('lab', 0),
                    'empty':           result.get('empty', 0),
                    'force_filled':    0,
                    'message':         result.get('message', ''),
                })
            else:
                tt.delete()
                results.append({
                    'department_id':   p['department_id'],
                    'department_name': p['department__name'],
                    'semester':        p['semester'],
                    'success':         False,
                    'error':           result.get('error', 'Generation failed') if result else 'Generation failed',
                })

        total_empty = sum(r.get('empty', 0) for r in results)
        failed      = sum(1 for r in results if not r['success'])

        return Response({
            'results':     results,
            'total_depts': len(results),
            'failed':      failed,
            'total_empty': total_empty,
        }, status=200)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_timetable_entry(request, entry_id):
    """
    Allow Admin or HOD to update a single timetable entry.
    If it's part of a Lab pair, updates both slots to ensure continuity.
    Validates global conflicts and faculty availability.
    """
    caller_role = _get_role(request.user)
    if caller_role not in ('admin', 'hod'):
        return Response({'error': 'Only Admin or HOD can edit timetable entries.'}, status=403)

    try:
        entry = TimetableEntry.objects.select_related(
            'timetable', 'timeslot', 'subject', 'faculty', 'classroom'
        ).get(id=entry_id)
    except TimetableEntry.DoesNotExist:
        return Response({'error': 'Entry not found.'}, status=404)

    subject_id   = request.data.get('subject')
    faculty_id   = request.data.get('faculty')
    classroom_id = request.data.get('classroom')

    new_subject   = Subject.objects.filter(id=subject_id).first()   if subject_id   else entry.subject
    new_faculty   = Faculty.objects.filter(id=faculty_id).first()   if faculty_id   else entry.faculty
    new_classroom = Classroom.objects.filter(id=classroom_id).first() if classroom_id else entry.classroom

    if not new_subject or not new_faculty or not new_classroom:
        return Response({'error': 'Invalid subject, faculty, or classroom.'}, status=400)

    # Detect Lab pair
    entries_to_update = [entry]
    if entry.lab_pair_id:
        entries_to_update = list(TimetableEntry.objects.filter(lab_pair_id=entry.lab_pair_id))
    
    # Sort by slot_number for consistent messaging
    entries_to_update.sort(key=lambda x: x.timeslot.slot_number)

    # --- Strict Validation for all affected slots ---
    for target in entries_to_update:
        slot = target.timeslot
        
        # 1. Availability Check
        avail = FacultyAvailability.objects.filter(faculty=new_faculty, timeslot=slot).first()
        if avail and not avail.is_available:
            return Response({
                'error': f'{new_faculty.user.get_full_name()} is marked as "Busy" on {slot.day} Slot {slot.slot_number}.'
            }, status=400)

        # 2. Global Faculty Conflict
        conflict = TimetableEntry.objects.filter(
            timeslot=slot, faculty=new_faculty, timetable__is_active=True
        ).exclude(id=target.id).first()
        if conflict:
            return Response({
                'error': f'{new_faculty.user.get_full_name()} is already assigned elsewhere on {slot.day} Slot {slot.slot_number} '
                         f'({conflict.timetable.department.name} Sem {conflict.timetable.semester}).'
            }, status=400)

        # 3. Global Classroom Conflict
        room_conflict = TimetableEntry.objects.filter(
            timeslot=slot, classroom=new_classroom, timetable__is_active=True
        ).exclude(id=target.id).first()
        if room_conflict:
            return Response({
                'error': f'Classroom {new_classroom.name} is already occupied on {slot.day} Slot {slot.slot_number}.'
            }, status=400)

    # --- Apply changes ---
    for target in entries_to_update:
        target.subject   = new_subject
        target.faculty   = new_faculty
        target.classroom = new_classroom
        # If subject type changed from Lab to Theory, we might need to break the pair
        # but for now, we assume the user intends to keep the 2-hour block if it was a lab.
        # If the NEW subject is a theory but they are updating a lab pair, it stays a pair.
        target.save()

    return Response(TimetableEntrySerializer(entry).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conflict_check_api(request):
    """
    Pre-generation conflict analysis for a dept+sem.
    Returns: missing faculty, unassigned subjects, slot conflicts, empty slots.
    """
    dept_id  = request.query_params.get('department')
    semester = request.query_params.get('semester')
    if not dept_id or not semester:
        return Response({'error': 'department and semester required'}, status=400)

    try:
        sem_int = int(semester)
        dept    = Department.objects.get(id=dept_id)
    except (ValueError, Department.DoesNotExist):
        return Response({'error': 'Invalid department or semester'}, status=400)

    issues   = []
    warnings = []

    # 1. Subjects with no faculty assigned
    subjects = Subject.objects.filter(department=dept, semester=sem_int)
    if not subjects.exists():
        issues.append({'type': 'error', 'msg': f'No subjects found for {dept.name} Sem {sem_int}.'})
        return Response({'issues': issues, 'warnings': warnings, 'ready': False})

    assigned_subject_ids = set(
        FacultyAssignment.objects.filter(department=dept, semester=sem_int)
        .values_list('subjects__id', flat=True)
    )
    for subj in subjects:
        if subj.id not in assigned_subject_ids:
            issues.append({'type': 'error', 'msg': f'Subject "{subj.code} - {subj.name}" has no faculty assigned.'})

    # 2. Faculty with no availability set
    fa_ids = set(FacultyAssignment.objects.filter(
        department=dept, semester=sem_int
    ).values_list('faculty_id', flat=True))

    for fid in fa_ids:
        avail_count = FacultyAvailability.objects.filter(
            faculty_id=fid, department=dept, semester=sem_int, is_available=True
        ).count()
        if avail_count == 0:
            fac = Faculty.objects.filter(id=fid).select_related('user').first()
            name = fac.user.get_full_name() if fac else f'Faculty #{fid}'
            issues.append({'type': 'error', 'msg': f'Faculty "{name}" has no availability slots set for this dept/sem.'})
        elif avail_count < subjects.count():
            fac = Faculty.objects.filter(id=fid).select_related('user').first()
            name = fac.user.get_full_name() if fac else f'Faculty #{fid}'
            warnings.append({'type': 'warning', 'msg': f'Faculty "{name}" has only {avail_count} available slots but {subjects.count()} subjects need coverage.'})

    # 3. Slot ownership conflicts (two faculty claiming same slot)
    from collections import defaultdict
    slot_claims = defaultdict(list)
    avail_records = FacultyAvailability.objects.filter(
        faculty_id__in=fa_ids, department=dept, semester=sem_int, is_available=True
    ).select_related('faculty__user', 'timeslot')
    for a in avail_records:
        slot_claims[a.timeslot_id].append(a.faculty.user.get_full_name())
    for slot_id, names in slot_claims.items():
        if len(names) > 1:
            ts = TimeSlot.objects.filter(id=slot_id).first()
            slot_label = f'{ts.day} Slot {ts.slot_number}' if ts else f'Slot #{slot_id}'
            warnings.append({'type': 'warning', 'msg': f'Multiple faculty claim {slot_label}: {", ".join(names)}. Only one will be used.'})

    # 4. No classrooms
    if not Classroom.objects.filter(is_lab=False).exists():
        issues.append({'type': 'error', 'msg': 'No theory classrooms configured. Add classrooms first.'})
    lab_subjects = subjects.filter(is_lab=True)
    if lab_subjects.exists() and not Classroom.objects.filter(is_lab=True).exists():
        issues.append({'type': 'error', 'msg': f'{lab_subjects.count()} lab subject(s) found but no lab rooms configured.'})

    ready = len(issues) == 0
    return Response({'issues': issues, 'warnings': warnings, 'ready': ready, 'subject_count': subjects.count()})


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def timeslot_detail_api(request, ts_id):
    try:
        ts = TimeSlot.objects.get(id=ts_id)
    except TimeSlot.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    if request.method == 'GET':
        return Response(TimeSlotSerializer(ts).data)
    if _get_role(request.user) != 'admin':
        return Response({'error': 'Admin only'}, status=403)
    if request.method == 'PUT':
        s = TimeSlotSerializer(ts, data=request.data, partial=True)
        if s.is_valid():
            s.save()
            return Response(s.data)
        return Response(s.errors, status=400)
    if request.method == 'DELETE':
        ts.delete()
        return Response({'message': 'Deleted'})


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def classroom_detail_api(request, room_id):
    try:
        room = Classroom.objects.get(id=room_id)
    except Classroom.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    if request.method == 'GET':
        return Response(ClassroomSerializer(room).data)
    if _get_role(request.user) != 'admin':
        return Response({'error': 'Admin only'}, status=403)
    if request.method == 'PUT':
        s = ClassroomSerializer(room, data=request.data, partial=True)
        if s.is_valid():
            s.save()
            return Response(s.data)
        return Response(s.errors, status=400)
    if request.method == 'DELETE':
        room.delete()
        return Response({'message': 'Deleted'})

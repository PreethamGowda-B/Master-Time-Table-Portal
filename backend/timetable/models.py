from django.db import models
from django.contrib.auth.models import User

ROLE_CHOICES = [
    ('admin', 'Admin'),
    ('hod', 'HOD'),
    ('faculty', 'Faculty'),
    ('student', 'Student'),
]

DAY_CHOICES = [
    ('Monday', 'Monday'), ('Tuesday', 'Tuesday'), ('Wednesday', 'Wednesday'),
    ('Thursday', 'Thursday'), ('Friday', 'Friday'), ('Saturday', 'Saturday'),
]


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class Department(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True)
    hod = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='hod_department')

    def __str__(self):
        return self.name


class Subject(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    semester = models.IntegerField()
    credits = models.IntegerField(default=3)
    is_lab = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.code} - {self.name}"


class Faculty(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    employee_id = models.CharField(max_length=20, unique=True)
    semester = models.IntegerField(null=True, blank=True)
    subjects = models.ManyToManyField(Subject, blank=True)

    def __str__(self):
        return f"{self.user.get_full_name()} ({self.employee_id})"


class FacultyAssignment(models.Model):
    """Links a faculty to a specific department+semester with their subjects for that combination."""
    faculty    = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='assignments')
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    semester   = models.IntegerField()
    subjects   = models.ManyToManyField(Subject, blank=True)

    class Meta:
        unique_together = ['faculty', 'department', 'semester']

    def __str__(self):
        return f"{self.faculty} — {self.department} Sem {self.semester}"


class Classroom(models.Model):
    name = models.CharField(max_length=50)
    capacity = models.IntegerField()
    is_lab = models.BooleanField(default=False)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.name


class TimeSlot(models.Model):
    day = models.CharField(max_length=10, choices=DAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_number = models.IntegerField()
    is_break = models.BooleanField(default=False)

    class Meta:
        ordering = ['day', 'slot_number']
        unique_together = ['day', 'slot_number']

    def __str__(self):
        return f"{self.day} {self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')}"


class FacultyAvailability(models.Model):
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE)
    timeslot = models.ForeignKey(TimeSlot, on_delete=models.CASCADE)
    is_available = models.BooleanField(default=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, null=True, blank=True)
    semester = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ['faculty', 'timeslot', 'department', 'semester']

    def __str__(self):
        return f"{self.faculty} - {self.timeslot} - {'Available' if self.is_available else 'Busy'}"


class Timetable(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    semester = models.IntegerField()
    academic_year = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.department} - Sem {self.semester} ({self.academic_year})"


class TimetableEntry(models.Model):
    timetable    = models.ForeignKey(Timetable, on_delete=models.CASCADE, related_name='entries')
    timeslot     = models.ForeignKey(TimeSlot, on_delete=models.CASCADE)
    subject      = models.ForeignKey(Subject, on_delete=models.CASCADE)
    faculty      = models.ForeignKey(Faculty, on_delete=models.CASCADE)
    classroom    = models.ForeignKey(Classroom, on_delete=models.CASCADE)
    is_lab_slot  = models.BooleanField(default=False)   # True for both slots of a lab pair
    lab_pair_id  = models.IntegerField(null=True, blank=True)  # same value for both slots of a pair

    class Meta:
        unique_together = [
            ['timetable', 'timeslot'],
        ]

    def __str__(self):
        return f"{self.timetable} | {self.timeslot} | {self.subject}"

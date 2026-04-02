from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from timetable.models import TimeSlot, Department, Classroom, UserProfile, Faculty
from datetime import time


class Command(BaseCommand):
    help = 'Setup initial data: time slots, departments, classrooms, and all role users'

    def handle(self, *args, **kwargs):

        # --- Time Slots ---
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        slots = [
            (1, time(9, 0),  time(10, 0)),
            (2, time(10, 0), time(11, 0)),
            (3, time(11, 0), time(12, 0)),
            (4, time(12, 0), time(13, 0)),
            (5, time(14, 0), time(15, 0)),
            (6, time(15, 0), time(16, 0)),
            (7, time(16, 0), time(17, 0)),
        ]
        for day in days:
            for num, start, end in slots:
                TimeSlot.objects.get_or_create(
                    day=day, slot_number=num,
                    defaults={'start_time': start, 'end_time': end}
                )
        self.stdout.write(self.style.SUCCESS(f'✔ Created {len(days) * len(slots)} time slots'))

        # --- Departments ---
        depts_data = [
            ('Computer Science', 'CS'),
            ('Business Administration', 'MBA'),
            ('Commerce', 'BCom'),
        ]
        depts = {}
        for name, code in depts_data:
            d, _ = Department.objects.get_or_create(code=code, defaults={'name': name})
            depts[code] = d
        self.stdout.write(self.style.SUCCESS('✔ Created departments'))

        # --- Classrooms ---
        rooms = [
            ('Room 101', 60, False), ('Room 102', 60, False),
            ('Room 201', 60, False), ('Room 202', 60, False),
            ('Lab 1', 30, True),     ('Lab 2', 30, True),
        ]
        for name, cap, is_lab in rooms:
            Classroom.objects.get_or_create(name=name, defaults={'capacity': cap, 'is_lab': is_lab})
        self.stdout.write(self.style.SUCCESS('✔ Created classrooms'))

        # --- Users ---
        users_to_create = [
            {
                'username': 'admin',
                'password': 'admin123',
                'first_name': 'Admin',
                'last_name': 'User',
                'email': 'admin@ewc.edu',
                'role': 'admin',
                'is_superuser': True,
                'is_staff': True,
            },
            {
                'username': 'hod_cs',
                'password': 'hod123',
                'first_name': 'Dr. Ramesh',
                'last_name': 'Kumar',
                'email': 'hod.cs@ewc.edu',
                'role': 'hod',
                'is_superuser': False,
                'is_staff': False,
                'dept_code': 'CS',
            },
            {
                'username': 'faculty',
                'password': 'faculty123',
                'first_name': 'Prof. Priya',
                'last_name': 'Sharma',
                'email': 'priya.sharma@ewc.edu',
                'role': 'faculty',
                'is_superuser': False,
                'is_staff': False,
                'dept_code': 'CS',
                'employee_id': 'EWC-F001',
            },
            {
                'username': 'student',
                'password': 'student123',
                'first_name': 'Rahul',
                'last_name': 'Nair',
                'email': 'rahul.nair@ewc.edu',
                'role': 'student',
                'is_superuser': False,
                'is_staff': False,
            },
        ]

        for u in users_to_create:
            if User.objects.filter(username=u['username']).exists():
                self.stdout.write(f'  ⚠ User "{u["username"]}" already exists, skipping.')
                continue

            user = User.objects.create_user(
                username=u['username'],
                password=u['password'],
                first_name=u['first_name'],
                last_name=u['last_name'],
                email=u['email'],
                is_superuser=u['is_superuser'],
                is_staff=u['is_staff'],
            )
            UserProfile.objects.create(user=user, role=u['role'])

            # Create Faculty record for faculty role
            if u['role'] == 'faculty':
                Faculty.objects.get_or_create(
                    user=user,
                    defaults={
                        'department': depts[u['dept_code']],
                        'employee_id': u['employee_id'],
                    }
                )

            # Assign HOD to department
            if u['role'] == 'hod' and 'dept_code' in u:
                dept = depts[u['dept_code']]
                dept.hod = user
                dept.save()

            self.stdout.write(self.style.SUCCESS(f'  ✔ Created {u["role"]} user: {u["username"]}'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write(self.style.SUCCESS('  LOGIN CREDENTIALS'))
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write('  Role     | Username   | Password')
        self.stdout.write('  ---------|------------|----------')
        self.stdout.write('  Admin    | admin      | admin123')
        self.stdout.write('  HOD      | hod_cs     | hod123')
        self.stdout.write('  Faculty  | faculty    | faculty123')
        self.stdout.write('  Student  | student    | student123')
        self.stdout.write(self.style.SUCCESS('=' * 50))
        self.stdout.write('')
        self.stdout.write('  Django Admin: http://127.0.0.1:8000/admin/')
        self.stdout.write('  Frontend App: http://localhost:5173/')
        self.stdout.write('')

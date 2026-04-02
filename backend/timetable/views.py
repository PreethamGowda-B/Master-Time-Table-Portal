from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import HttpResponse
from .models import (Department, Subject, Faculty, Classroom, TimeSlot,
                     FacultyAvailability, Timetable, TimetableEntry, UserProfile)
from .forms import SubjectForm, FacultyAvailabilityForm, GenerateTimetableForm
from .utils import generate_timetable_auto, generate_pdf
import random


def login_view(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']
        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            return redirect('dashboard')
        messages.error(request, 'Invalid credentials.')
    return render(request, 'login.html')


def logout_view(request):
    logout(request)
    return redirect('login')


@login_required
def dashboard(request):
    role = 'student'
    try:
        role = request.user.userprofile.role
    except UserProfile.DoesNotExist:
        if request.user.is_superuser:
            role = 'admin'
    context = {
        'role': role,
        'departments': Department.objects.count(),
        'subjects': Subject.objects.count(),
        'faculties': Faculty.objects.count(),
        'timetables': Timetable.objects.filter(is_active=True).count(),
    }
    return render(request, 'dashboard.html', context)


@login_required
def add_subject(request):
    if request.method == 'POST':
        form = SubjectForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Subject added successfully.')
            return redirect('add_subject')
    else:
        form = SubjectForm()
    subjects = Subject.objects.select_related('department').all()
    return render(request, 'add_subject.html', {'form': form, 'subjects': subjects})


@login_required
def add_faculty_availability(request):
    timeslots = TimeSlot.objects.all().order_by('slot_number')
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    slots_by_day = {day: timeslots.filter(day=day) for day in days}

    if request.method == 'POST':
        faculty_id = request.POST.get('faculty')
        faculty = get_object_or_404(Faculty, id=faculty_id)
        FacultyAvailability.objects.filter(faculty=faculty).delete()
        for slot in timeslots:
            is_available = request.POST.get(f'slot_{slot.id}') == 'on'
            FacultyAvailability.objects.create(
                faculty=faculty, timeslot=slot, is_available=is_available
            )
        messages.success(request, f'Availability updated for {faculty}.')
        return redirect('add_faculty_availability')

    faculties = Faculty.objects.select_related('user', 'department').all()
    return render(request, 'add_faculty_availability.html', {
        'faculties': faculties,
        'slots_by_day': slots_by_day,
        'days': days,
    })


@login_required
def generate_timetable(request):
    form = GenerateTimetableForm()
    if request.method == 'POST':
        form = GenerateTimetableForm(request.POST)
        if form.is_valid():
            dept = form.cleaned_data['department']
            sem = form.cleaned_data['semester']
            year = form.cleaned_data['academic_year']
            Timetable.objects.filter(department=dept, semester=sem, is_active=True).update(is_active=False)
            tt = Timetable.objects.create(department=dept, semester=sem, academic_year=year)
            result = generate_timetable_auto(tt)
            if result:
                messages.success(request, 'Timetable generated successfully.')
                return redirect('department_view', dept_id=dept.id)
            else:
                tt.delete()
                messages.error(request, 'Could not generate timetable. Check faculty availability and subjects.')
    return render(request, 'generate_timetable.html', {'form': form})


@login_required
def department_view(request, dept_id):
    department = get_object_or_404(Department, id=dept_id)
    semester = request.GET.get('semester', 1)
    timetable = Timetable.objects.filter(
        department=department, semester=semester, is_active=True
    ).first()
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    timeslots = TimeSlot.objects.filter(day='Monday').order_by('slot_number')
    grid = {}
    if timetable:
        for day in days:
            grid[day] = {}
            for slot in TimeSlot.objects.filter(day=day).order_by('slot_number'):
                entry = timetable.entries.filter(timeslot=slot).first()
                grid[day][slot] = entry
    departments = Department.objects.all()
    return render(request, 'department_view.html', {
        'department': department,
        'departments': departments,
        'timetable': timetable,
        'grid': grid,
        'days': days,
        'timeslots': timeslots,
        'semester': int(semester),
        'semesters': range(1, 9),
    })


@login_required
def faculty_timetable(request, faculty_id=None):
    faculties = Faculty.objects.select_related('user', 'department').all()
    faculty = None
    entries = []
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    grid = {}

    if faculty_id:
        faculty = get_object_or_404(Faculty, id=faculty_id)
        entries = TimetableEntry.objects.filter(
            faculty=faculty, timetable__is_active=True
        ).select_related('timeslot', 'subject', 'classroom', 'timetable__department')
        for day in days:
            grid[day] = {}
            for slot in TimeSlot.objects.filter(day=day).order_by('slot_number'):
                entry = entries.filter(timeslot=slot).first()
                grid[day][slot] = entry

    return render(request, 'faculty_view.html', {
        'faculties': faculties,
        'faculty': faculty,
        'grid': grid,
        'days': days,
    })


@login_required
def download_pdf(request, timetable_id):
    timetable = get_object_or_404(Timetable, id=timetable_id)
    pdf = generate_pdf(timetable)
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="timetable_{timetable.department.code}_sem{timetable.semester}.pdf"'
    return response


@login_required
def download_faculty_pdf(request, faculty_id):
    faculty = get_object_or_404(Faculty, id=faculty_id)
    pdf = generate_pdf(None, faculty=faculty)
    response = HttpResponse(pdf, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="timetable_{faculty.employee_id}.pdf"'
    return response

from django.contrib import admin
from .models import (Department, Subject, Faculty, Classroom,
                     TimeSlot, FacultyAvailability, Timetable, TimetableEntry, UserProfile)

admin.site.site_header = "East West College of Management"
admin.site.site_title = "EWC Timetable Admin"
admin.site.index_title = "Master Timetable Portal"

admin.site.register(UserProfile)
admin.site.register(Department)
admin.site.register(Subject)
admin.site.register(Faculty)
admin.site.register(Classroom)
admin.site.register(TimeSlot)
admin.site.register(FacultyAvailability)
admin.site.register(Timetable)
admin.site.register(TimetableEntry)

from rest_framework import serializers
from django.contrib.auth.models import User
from timetable.models import (Department, Subject, Faculty, FacultyAssignment, Classroom,
                     TimeSlot, FacultyAvailability, Timetable, TimetableEntry, UserProfile)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'


class SubjectSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = Subject
        fields = '__all__'


class FacultySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    full_name = serializers.SerializerMethodField()
    subjects_detail = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def get_subjects_detail(self, obj):
        return [{'id': s.id, 'code': s.code, 'name': s.name, 'semester': s.semester} for s in obj.subjects.all()]

    class Meta:
        model = Faculty
        fields = '__all__'


class ClassroomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Classroom
        fields = '__all__'


class TimeSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeSlot
        fields = '__all__'


class FacultyAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = FacultyAvailability
        fields = '__all__'


class TimetableEntrySerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    subject_is_lab = serializers.BooleanField(source='subject.is_lab', read_only=True)
    faculty_name = serializers.SerializerMethodField()
    classroom_name = serializers.CharField(source='classroom.name', read_only=True)
    day = serializers.CharField(source='timeslot.day', read_only=True)
    start_time = serializers.TimeField(source='timeslot.start_time', read_only=True)
    end_time = serializers.TimeField(source='timeslot.end_time', read_only=True)
    slot_number = serializers.IntegerField(source='timeslot.slot_number', read_only=True)
    timeslot_id = serializers.IntegerField(source='timeslot.id', read_only=True)

    def get_faculty_name(self, obj):
        return obj.faculty.user.get_full_name() or obj.faculty.user.username

    class Meta:
        model = TimetableEntry
        fields = '__all__'

class TimetableSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    entries = TimetableEntrySerializer(many=True, read_only=True)

    class Meta:
        model = Timetable
        fields = '__all__'

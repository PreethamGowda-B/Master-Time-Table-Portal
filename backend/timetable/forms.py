from django import forms
from .models import Subject, Faculty, FacultyAvailability, Timetable, TimeSlot, Department


class SubjectForm(forms.ModelForm):
    class Meta:
        model = Subject
        fields = ['name', 'code', 'department', 'semester', 'credits', 'is_lab']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control'}),
            'code': forms.TextInput(attrs={'class': 'form-control'}),
            'department': forms.Select(attrs={'class': 'form-select'}),
            'semester': forms.NumberInput(attrs={'class': 'form-control'}),
            'credits': forms.NumberInput(attrs={'class': 'form-control'}),
            'is_lab': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }


class FacultyAvailabilityForm(forms.Form):
    faculty = forms.ModelChoiceField(
        queryset=Faculty.objects.all(),
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        timeslots = TimeSlot.objects.all().order_by('slot_number')
        for slot in timeslots:
            field_name = f'slot_{slot.id}'
            self.fields[field_name] = forms.BooleanField(
                required=False,
                label=f"{slot.day} {slot.start_time.strftime('%H:%M')}-{slot.end_time.strftime('%H:%M')}",
                widget=forms.CheckboxInput(attrs={'class': 'form-check-input'})
            )


class GenerateTimetableForm(forms.Form):
    department = forms.ModelChoiceField(
        queryset=Department.objects.all(),
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    semester = forms.IntegerField(
        min_value=1, max_value=8,
        widget=forms.NumberInput(attrs={'class': 'form-control'})
    )
    academic_year = forms.CharField(
        max_length=20,
        initial='2024-25',
        widget=forms.TextInput(attrs={'class': 'form-control'})
    )

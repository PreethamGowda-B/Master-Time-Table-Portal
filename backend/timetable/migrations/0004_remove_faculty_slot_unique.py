from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('timetable', '0003_faculty_semester'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='timetableentry',
            unique_together={
                ('timetable', 'timeslot'),
                ('timeslot', 'classroom'),
            },
        ),
    ]

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('timetable', '0005_facultyassignment'),
    ]

    operations = [
        migrations.AddField(
            model_name='timetableentry',
            name='is_lab_slot',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='timetableentry',
            name='lab_pair_id',
            field=models.IntegerField(blank=True, null=True),
        ),
    ]

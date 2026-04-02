from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('timetable', '0002_timeslot_is_break'),
    ]

    operations = [
        migrations.AddField(
            model_name='faculty',
            name='semester',
            field=models.IntegerField(null=True, blank=True),
        ),
    ]

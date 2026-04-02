from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('timetable', '0004_remove_faculty_slot_unique'),
    ]

    operations = [
        migrations.CreateModel(
            name='FacultyAssignment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('semester', models.IntegerField()),
                ('department', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='timetable.department')),
                ('faculty', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assignments', to='timetable.faculty')),
                ('subjects', models.ManyToManyField(blank=True, to='timetable.subject')),
            ],
            options={
                'unique_together': {('faculty', 'department', 'semester')},
            },
        ),
    ]

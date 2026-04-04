from django.urls import path, include
from rest_framework.routers import DefaultRouter
from timetable import api_views

router = DefaultRouter()
router.register('departments', api_views.DepartmentViewSet)
router.register('subjects', api_views.SubjectViewSet)
router.register('faculty', api_views.FacultyViewSet)
router.register('classrooms', api_views.ClassroomViewSet)
router.register('timeslots', api_views.TimeSlotViewSet)
router.register('timetables', api_views.TimetableViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
    path('api/auth/login/', api_views.login_api),
    path('api/auth/logout/', api_views.logout_api),
    path('api/auth/me/', api_views.me),
    path('api/auth/register-admin/', api_views.register_admin_api),
    path('api/auth/admin-exists/', api_views.admin_exists_api),
    path('api/auth/create-user/', api_views.create_user_api),
    path('api/auth/users/', api_views.list_users_api),
    path('api/auth/users/<int:user_id>/', api_views.delete_user_api),
    path('api/auth/users/<int:user_id>/edit/', api_views.edit_user_api),
    path('api/auth/faculty-users/', api_views.list_faculty_users_api),
    path('api/faculty-availability/all/', api_views.all_faculty_availability),
    path('api/faculty-availability/', api_views.faculty_availability),
    path('api/faculty-assignments/', api_views.faculty_assignments),
    path('api/dept-slot-assignments/', api_views.dept_slot_assignments),
    path('api/timeslot-occupancy/', api_views.timeslot_occupancy_api),
    path('api/faculty-workload/', api_views.faculty_workload),
    path('api/timetable-entries/<int:entry_id>/', api_views.update_timetable_entry),
    path('api/conflict-check/', api_views.conflict_check_api),
    path('api/timeslots/<int:ts_id>/', api_views.timeslot_detail_api),
    path('api/classrooms/<int:room_id>/', api_views.classroom_detail_api),
    path('api/timetables/export-pdf/', api_views.export_combined_pdf),
]

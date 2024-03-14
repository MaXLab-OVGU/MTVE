from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Account, Room

# Register your models here.


class AccountAdmin(UserAdmin):
    list_display = ("email", "username", "date_joined", "last_login", "is_admin")
    search_fields = ("email", "username")
    readonly_fields = ("date_joined", "last_login")

    filter_horizontal = ()
    list_filter = ()
    fieldsets = ()


admin.site.register(Account, AccountAdmin)
admin.site.register(Room)

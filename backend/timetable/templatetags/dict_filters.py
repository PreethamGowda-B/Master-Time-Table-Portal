from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    """Get item from dict by key in templates."""
    if hasattr(dictionary, 'get'):
        return dictionary.get(key)
    return None

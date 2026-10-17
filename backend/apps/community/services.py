from django.db.models import Q
from django.utils import timezone
from apps.accounts.models import Profile
from apps.rooms.models import Room
from apps.projects.models import Project
from apps.safety.models import Block


def blocked_ids(user):
    pairs = Block.objects.filter(Q(blocker=user) | Q(blocked=user)).values_list('blocker_id', 'blocked_id')
    return {other for pair in pairs for other in pair if other != user.id}


def visible_profiles(user):
    return Profile.objects.filter(user__is_active=True, discoverable=True, onboarding_complete=True).exclude(
        user_id__in=blocked_ids(user)).exclude(user=user).select_related('user').prefetch_related('interests', 'skills', 'learning', 'prompts', 'photos')


def visible_rooms(user):
    return Room.objects.filter(host__is_active=True).exclude(host_id__in=blocked_ids(user)).select_related('host__profile').prefetch_related('tags', 'rsvps')


def visible_projects(user):
    return Project.objects.filter(owner__is_active=True).exclude(owner_id__in=blocked_ids(user)).select_related('owner__profile').prefetch_related('tags', 'needed_skills', 'requests')


def mentor_score(viewer, candidate):
    interests = {tag.id for tag in viewer.interests.all()}
    learning = {tag.id for tag in viewer.learning.all()}
    shared = [tag for tag in candidate.interests.all() if tag.id in interests]
    if viewer.intent == 'mentor':
        skills = {tag.id for tag in viewer.skills.all()}
        overlap = [tag for tag in candidate.learning.all() if tag.id in skills]
        reasons = [f'You can help with {tag.label}' for tag in overlap]
    else:
        overlap = [tag for tag in candidate.skills.all() if tag.id in learning]
        reasons = [f'They can help with {tag.label}' for tag in overlap]
    reasons = [f'You both care about {tag.label}' for tag in shared] + reasons
    return (len(shared), len(overlap)), reasons[:3] or ['Explore someone new']


def mentors(user):
    intent = user.profile.intent
    eligible = visible_profiles(user)
    if intent == 'learn':
        eligible = eligible.filter(intent__in=['mentor', 'both'])
    elif intent == 'mentor':
        eligible = eligible.filter(intent__in=['learn', 'both'])
    return sorted(eligible, key=lambda p: (*[-v for v in mentor_score(user.profile, p)[0]], p.user_id))


def recommendations(user, tags=None):
    interests = set(tags if tags is not None else user.profile.interests.values_list('id', flat=True))
    def score(item):
        return len(interests & {t.id for t in item.tags.all()})
    rooms = sorted(visible_rooms(user).filter(status='scheduled', starts_at__gt=timezone.now()),
                   key=lambda r: (-score(r), r.starts_at, r.id))
    projects = sorted(visible_projects(user).filter(status='open'),
                      key=lambda p: (-score(p), -p.created_at.timestamp(), p.id))
    people = mentors(user)
    if tags is not None:
        people = sorted(people, key=lambda p: (-len(interests & {t.id for t in p.interests.all()}), p.user_id))
    return rooms, people, projects

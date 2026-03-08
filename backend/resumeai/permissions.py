from rest_framework.permissions import BasePermission

from .models import Plan, UserSubscription


class HasProPlan(BasePermission):
    """Allow access only for Pro subscribers."""

    message = "Portfolio is a Pro feature. Upgrade to Pro to create your portfolio."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        sub, _ = UserSubscription.objects.get_or_create(user=request.user)
        sub.reset_if_new_month()
        return sub.plan == Plan.PRO


class HasFeatureAccess(BasePermission):
    """
    Use like:
    permission_classes = [IsAuthenticated, HasFeatureAccess.with_feature(Feature.ATS_OPTIMIZE)]
    """

    feature = None

    @classmethod
    def with_feature(cls, feature):
        subclass = type(f"HasFeatureAccess_{feature}", (cls,), {"feature": feature})
        return subclass

    def has_permission(self, request, view):
        sub, _ = UserSubscription.objects.get_or_create(user=request.user)
        sub.reset_if_new_month()
        limit = sub.limit_for(self.feature)
        used = sub.uses_for(self.feature)
        if used >= limit:
            self.message = f"Monthly limit reached for {self.feature} ({used}/{limit}). Upgrade plan to continue."
        return used < limit
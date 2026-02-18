"""Add subscription fields to users

Revision ID: 1fb3903d043e
Revises: d9edd86a36e6
Create Date: 2026-02-18 10:29:22.961163+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1fb3903d043e"
down_revision: Union[str, Sequence[str], None] = "d9edd86a36e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add subscription and billing fields to the users table."""
    # Create enum types first (must exist before columns that use them)
    subscriptiontier = sa.Enum("FREE", "PREMIUM", name="subscriptiontier")
    subscriptiontier.create(op.get_bind(), checkfirst=True)

    subscriptionstatus = sa.Enum(
        "NONE",
        "TRIALING",
        "ACTIVE",
        "PAST_DUE",
        "CANCELED",
        "INCOMPLETE",
        "UNPAID",
        name="subscriptionstatus",
    )
    subscriptionstatus.create(op.get_bind(), checkfirst=True)

    billingcycle = sa.Enum("MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "LIFETIME", name="billingcycle")
    billingcycle.create(op.get_bind(), checkfirst=True)

    # Add subscription columns (create_type=False because we created the types above)
    op.add_column(
        "users",
        sa.Column(
            "subscription_tier",
            sa.Enum("FREE", "PREMIUM", name="subscriptiontier", create_type=False),
            server_default=sa.text("'FREE'"),
            nullable=False,
            comment="User subscription tier: free, premium, founders",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "subscription_status",
            sa.Enum(
                "NONE",
                "TRIALING",
                "ACTIVE",
                "PAST_DUE",
                "CANCELED",
                "INCOMPLETE",
                "UNPAID",
                name="subscriptionstatus",
                create_type=False,
            ),
            server_default=sa.text("'NONE'"),
            nullable=False,
            comment="Stripe subscription lifecycle status",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "stripe_customer_id",
            sa.String(length=255),
            nullable=True,
            comment="Stripe customer ID (cus_xxx)",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "stripe_subscription_id",
            sa.String(length=255),
            nullable=True,
            comment="Stripe subscription ID (sub_xxx)",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "trial_start_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the user's trial period started",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "trial_end_date",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the user's trial period ends/ended",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "subscription_created_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the subscription was first created",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "subscription_resubscribed_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the user last resubscribed after cancellation",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "subscription_current_period_end",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="End of current billing period (from Stripe)",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "subscription_cancel_at_period_end",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
            comment="Whether subscription cancels at period end",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "billing_cycle",
            sa.Enum(
                "MONTHLY",
                "QUARTERLY",
                "SEMI_ANNUAL",
                "LIFETIME",
                name="billingcycle",
                create_type=False,
            ),
            nullable=True,
            comment="Current billing cycle: monthly, quarterly, semi_annual, lifetime",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "grandfathered_price_id",
            sa.String(length=255),
            nullable=True,
            comment="Stripe price ID locked in for grandfathered users",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "grandfathered_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="When the user was grandfathered into their price",
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "grandfathered_amount",
            sa.Integer(),
            nullable=True,
            comment="Grandfathered price amount in EUR cents",
        ),
    )

    # Create indexes (stripe_customer_id and stripe_subscription_id are unique)
    op.create_index(
        op.f("ix_users_stripe_customer_id"), "users", ["stripe_customer_id"], unique=True
    )
    op.create_index(
        op.f("ix_users_stripe_subscription_id"), "users", ["stripe_subscription_id"], unique=True
    )
    op.create_index(
        op.f("ix_users_subscription_status"), "users", ["subscription_status"], unique=False
    )
    op.create_index(
        op.f("ix_users_subscription_tier"), "users", ["subscription_tier"], unique=False
    )


def downgrade() -> None:
    """Remove subscription and billing fields from the users table."""
    # Drop indexes first
    op.drop_index(op.f("ix_users_subscription_tier"), table_name="users")
    op.drop_index(op.f("ix_users_subscription_status"), table_name="users")
    op.drop_index(op.f("ix_users_stripe_subscription_id"), table_name="users")
    op.drop_index(op.f("ix_users_stripe_customer_id"), table_name="users")

    # Drop columns (must happen before enum type drops)
    op.drop_column("users", "grandfathered_amount")
    op.drop_column("users", "grandfathered_at")
    op.drop_column("users", "grandfathered_price_id")
    op.drop_column("users", "billing_cycle")
    op.drop_column("users", "subscription_cancel_at_period_end")
    op.drop_column("users", "subscription_current_period_end")
    op.drop_column("users", "subscription_resubscribed_at")
    op.drop_column("users", "subscription_created_at")
    op.drop_column("users", "trial_end_date")
    op.drop_column("users", "trial_start_date")
    op.drop_column("users", "stripe_subscription_id")
    op.drop_column("users", "stripe_customer_id")
    op.drop_column("users", "subscription_status")
    op.drop_column("users", "subscription_tier")

    # Drop enum types after all referencing columns are gone
    postgresql.ENUM(
        "FREE",
        "PREMIUM",
        name="subscriptiontier",
    ).drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(
        "NONE",
        "TRIALING",
        "ACTIVE",
        "PAST_DUE",
        "CANCELED",
        "INCOMPLETE",
        "UNPAID",
        name="subscriptionstatus",
    ).drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(
        "MONTHLY",
        "QUARTERLY",
        "SEMI_ANNUAL",
        "LIFETIME",
        name="billingcycle",
    ).drop(op.get_bind(), checkfirst=True)

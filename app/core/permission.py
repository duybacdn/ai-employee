def get_user_scope(db, current_user):
    from app.models.core import CompanyUser

    # SUPERADMIN → full access
    if current_user.role == "superadmin":
        return {
            "is_superadmin": True,
            "company_ids": []
        }

    company_ids = (
        db.query(CompanyUser.company_id)
        .filter(CompanyUser.user_id == current_user.id)
        .all()
    )

    return {
        "is_superadmin": False,
        "company_ids": [c[0] for c in company_ids]
    }
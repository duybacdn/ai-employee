def select_employee_for_channel(db, channel_id):
    from app.models.core import ChannelEmployee, Employee

    rows = (
        db.query(ChannelEmployee)
        .join(Employee, Employee.id == ChannelEmployee.employee_id)
        .filter(
            ChannelEmployee.channel_id == channel_id,
            ChannelEmployee.is_active == True,
            Employee.is_active == True,
        )
        .order_by(ChannelEmployee.priority.asc())
        .all()
    )

    if not rows:
        return None

    # 🔥 lấy thằng priority cao nhất
    return rows[0]
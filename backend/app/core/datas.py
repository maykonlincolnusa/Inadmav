"""Calendário da secretaria (Brasília, UTC-3), independente do servidor."""

from datetime import date, datetime, timedelta, timezone

FUSO_SEDE = timezone(timedelta(hours=-3))


def hoje_na_sede() -> date:
    return datetime.now(FUSO_SEDE).date()

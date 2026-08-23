class AccxError(RuntimeError):
    """Sanitized ACCX transport or policy error. It never embeds request secrets."""

    def __init__(self, message: str = "ACCX request was rejected.", *, status: int = 0) -> None:
        super().__init__(message)
        self.status = status
        self.retryable = status in (0, 408, 429) or status >= 500

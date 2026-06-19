export const notFoundHandler = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = error.statusCode || error.status || 500;
  res.status(status).json({
    message: status === 500 ? "Internal server error" : error.message,
    ...(process.env.NODE_ENV === "production" ? {} : { detail: error.message }),
  });
};

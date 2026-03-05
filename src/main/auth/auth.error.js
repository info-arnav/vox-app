export const createError = (code, message, status = null) => {
  const error = new Error(message)
  error.code = code

  if (status) {
    error.status = status
  }

  return error
}

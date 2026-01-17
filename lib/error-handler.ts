export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  } else if (typeof error === 'string') {
    return error
  } else {
    return 'An unknown error occurred'
  }
}

export function getErrorDetails(error: unknown): {
  message: string
  stack?: string
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    }
  }
  
  return {
    message: String(error)
  }
}
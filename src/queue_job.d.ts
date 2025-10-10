/**
 * Run an async awaitable only when all other async calls registered
 * with the same bucket have completed (or thrown).
 * 
 * @param bucket - A hashable key representing the task queue to use
 * @param awaitable - An async function to execute
 * @returns A promise that resolves with the result of the awaitable function
 */
declare function queueJob<T>(
  bucket: string | number | object,
  awaitable: () => Promise<T>
): Promise<T>;

export = queueJob;

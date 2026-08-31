export class AppException extends Error {
    constructor(message: string) {
        super(`[AppException] ${message}`);
    }
}
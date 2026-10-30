class ExecutionError extends Error {
	constructor(message, options) {
		super(message, options);
		this.name = this.constructor.name;
	}
}
class LockError extends Error {
	constructor(message, options) {
		super(message, options);
		this.name = this.constructor.name;
	}
}

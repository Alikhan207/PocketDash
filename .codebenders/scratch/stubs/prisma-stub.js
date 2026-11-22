class PrismaClientKnownRequestError extends Error { constructor(m, c) { super(m); this.code = c; } }
module.exports = { Prisma: { PrismaClientKnownRequestError } };

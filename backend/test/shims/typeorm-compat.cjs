// CommonJS copy of @nestjs/typeorm/dist/common/typeorm-compat.js for Jest.
// The original uses `import.meta.url`, which cannot be compiled to CommonJS,
// so the e2e config maps it here. Behaviour is identical: resolve optional
// TypeORM exports that were removed in TypeORM v1 (undefined on v1+).
function resolveTypeormExport(name) {
  try {
    return require('typeorm')[name];
  } catch {
    return undefined;
  }
}
exports.Connection = resolveTypeormExport('Connection');
exports.AbstractRepository = resolveTypeormExport('AbstractRepository');

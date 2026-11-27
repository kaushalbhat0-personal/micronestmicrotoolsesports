// Avatar domain errors (G1-5).
// Authoritative: 07 section 3 (repositories throw domain errors, never raw
// PostgREST/storage errors to UI) + 08 T6 (storage abuse).
// Messages are generic by design: no UIDs, no bucket internals, no storage
// error detail.

export class AvatarValidationError extends Error {
  constructor() {
    super("Invalid avatar file. Use PNG, JPEG or WebP up to 512 KB.");
    this.name = "AvatarValidationError";
  }
}

export class AvatarOperationError extends Error {
  constructor() {
    super("Could not save your avatar. Please retry.");
    this.name = "AvatarOperationError";
  }
}

import { NotFoundError } from "../errors.js";

/**
 * Common scaffolding for domain services. Kept minimal on purpose — subclasses
 * still own their validation and error throwing. What lives here is just the
 * "does the row exist?" guard that otherwise gets copy-pasted into every
 * mutation method.
 *
 * Pass the repo explicitly to requireActive (rather than storing it on the
 * base) so the base stays decoupled from any subclass-specific field
 * convention. Subclasses typically call `this.requireActive(this.repo, id)`.
 */
export class BaseService {
  constructor({ entityName }) {
    if (!entityName) {
      throw new Error("BaseService requires an entityName (e.g. 'Duck')");
    }
    this.entityName = entityName;
  }

  async requireActive(repo, id) {
    const item = await repo.findById(id);
    if (!item) {
      throw new NotFoundError(`${this.entityName} ${id} not found`);
    }
    return item;
  }
}

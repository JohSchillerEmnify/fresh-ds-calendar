/** One file in a person's hidden Drive app folder (`appDataFolder`). */
export interface DriveFile {
  id: string;
  name: string;
  /** RFC 3339 instant the file was created. */
  createdTime: string;
}

/** A failed Drive call; `status` is the HTTP status when Google answered. */
export class DriveError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/**
 * One person's hidden Drive app folder (feature drive-backup). The real client
 * (`providers/google/GoogleDrive.ts`) and the TEST_MODE double (`providers/mock/MockDrive.ts`) share this contract.
 */
export interface DriveClient {
  /** Files whose name starts with `namePrefix`, in no particular order. */
  list(namePrefix: string): Promise<DriveFile[]>;
  /** Creates a new JSON file with this name and content. */
  create(name: string, content: string): Promise<DriveFile>;
  /** The text content of a file; a {@link DriveError} with status 404 when it is gone. */
  get(id: string): Promise<string>;
  /** Deletes a file; deleting one that is already gone is not an error. */
  delete(id: string): Promise<void>;
}

/**
 * Command Pattern for Undo/Redo functionality
 * Each command encapsulates an action and its inverse
 */

import { deleteField } from "firebase/firestore";

export class Command {
  /**
   * Execute the command
   * @returns {Promise<any>} Result of the command
   */
  async execute() {
    throw new Error("Command.execute() must be implemented");
  }

  /**
   * Undo the command
   * @returns {Promise<any>} Result of the undo
   */
  async undo() {
    throw new Error("Command.undo() must be implemented");
  }

  /**
   * Get a description of the command for UI display
   * @returns {string} Description
   */
  getDescription() {
    return "Unknown command";
  }
}

/**
 * Command to create an ImportantInfo item
 */
export class CreateItemCommand extends Command {
  constructor(serviceModule, payload, userContext, onSuccess) {
    super();
    this.serviceModule = serviceModule;
    this.payload = payload;
    this.userContext = userContext;
    this.onSuccess = onSuccess;
    this.createdId = null;
  }

  async execute() {
    const id = await this.serviceModule.createImportantInfo(
      this.payload,
      this.userContext,
    );
    this.createdId = id;
    if (this.onSuccess) this.onSuccess(id);
    return id;
  }

  async undo() {
    if (this.createdId) {
      await this.serviceModule.deleteImportantInfo(
        this.createdId,
        this.userContext,
      );
    }
  }

  getDescription() {
    return `Create "${this.payload.title || "Untitled"}"`;
  }
}

/**
 * Command to update an ImportantInfo item
 */
export class UpdateItemCommand extends Command {
  constructor(
    serviceModule,
    itemId,
    newChanges,
    previousState,
    userContext,
    onSuccess,
  ) {
    super();
    this.serviceModule = serviceModule;
    this.itemId = itemId;
    this.newChanges = newChanges;
    this.previousState = previousState;
    this.userContext = userContext;
    this.onSuccess = onSuccess;
  }

  async execute() {
    await this.serviceModule.updateImportantInfo(
      this.itemId,
      this.newChanges,
      this.userContext,
      this.previousState,
    );
    if (this.onSuccess) this.onSuccess(this.itemId);
  }

  async undo() {
    // Restore previous state
    // Find fields that were added in newChanges but didn't exist in previousState
    // These need to be explicitly deleted using deleteField()
    const restorePayload = { ...this.previousState };

    // For optional fields that were added but didn't exist before, mark them for deletion
    const optionalFields = ["phone", "url", "details", "blurb", "smsTemplate"];
    for (const field of optionalFields) {
      if (field in this.newChanges && !(field in this.previousState)) {
        // Field was added in the change but didn't exist before - delete it
        restorePayload[field] = deleteField();
      }
    }

    await this.serviceModule.updateImportantInfo(
      this.itemId,
      restorePayload,
      this.userContext,
      {
        ...this.previousState,
        ...this.newChanges,
      },
    );
  }

  getDescription() {
    return `Update "${this.previousState.title || "item"}"`;
  }
}

/**
 * Command to delete an ImportantInfo item
 */
export class DeleteItemCommand extends Command {
  constructor(serviceModule, itemId, snapshot, userContext, onSuccess) {
    super();
    this.serviceModule = serviceModule;
    this.itemId = itemId;
    this.snapshot = snapshot;
    this.userContext = userContext;
    this.onSuccess = onSuccess;
  }

  async execute() {
    await this.serviceModule.deleteImportantInfo(this.itemId, this.userContext);
    if (this.onSuccess) this.onSuccess(this.itemId);
  }

  async undo() {
    // Restore the deleted item
    await this.serviceModule.restoreImportantInfo(
      this.snapshot,
      this.userContext,
    );
  }

  getDescription() {
    return `Delete "${this.snapshot.title || "item"}"`;
  }
}

/**
 * Command History Manager
 * Manages undo/redo stacks with a maximum history size
 */
export class CommandHistory {
  constructor(maxHistorySize = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Execute a command and add it to the history
   */
  async execute(command) {
    await command.execute();
    this.undoStack.push(command);

    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }

    // Clear redo stack when new command is executed
    this.redoStack = [];
  }

  /**
   * Undo the last command
   */
  async undo() {
    if (this.undoStack.length === 0) {
      throw new Error("Nothing to undo");
    }

    const command = this.undoStack.pop();
    await command.undo();
    this.redoStack.push(command);
  }

  /**
   * Redo the last undone command
   */
  async redo() {
    if (this.redoStack.length === 0) {
      throw new Error("Nothing to redo");
    }

    const command = this.redoStack.pop();
    await command.execute();
    this.undoStack.push(command);
  }

  /**
   * Check if undo is available
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Get the description of the next undo command
   */
  getUndoDescription() {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].getDescription();
  }

  /**
   * Get the description of the next redo command
   */
  getRedoDescription() {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].getDescription();
  }

  /**
   * Clear all history
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Get current history state
   */
  getState() {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDescription: this.getUndoDescription(),
      redoDescription: this.getRedoDescription(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }
}

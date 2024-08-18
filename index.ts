/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * FieldKind
 * Represents the types that can be used in SurrealDB.
 */
type GenericType = '$$generic';
type BasicType =
  | GenericType
  | 'any'
  | 'null'
  | 'bool'
  | 'bytes'
  | 'datetime'
  | 'decimal'
  | 'duration'
  | 'float'
  | 'int'
  | 'number'
  | 'object'
  | 'point'
  | 'string'
  | 'uuid';
type TypedType = 'geometry' | 'object' | 'option' | 'set' | 'array' | 'record';
type FieldType = BasicType | TypedType;
type GeometryDataTypes =
  | 'feature'
  | 'point'
  | 'LineString'
  | 'polygon'
  | 'multipoint'
  | 'multiline'
  | 'multipolygon'
  | 'collection';

/**
 * FieldSchemaProperty
 * Represents a property within a SurrealDB schema.
 */
interface FieldSchemaProperty {
  type?: BasicType | TypedType;
  default?: string;
  value?: string;
  assertion?: string;
  indexed?: boolean;
  unique?: boolean;
  primary?: boolean;
  optional?: boolean;
}

interface PrimaryFieldConfig extends FieldSchemaProperty {
  primary: boolean;
}

interface BasicFieldConfig extends FieldSchemaProperty {
  type: BasicType;
}

interface TypedFieldConfig extends FieldSchemaProperty {
  type: TypedType;
  typed?: string | BasicType | typeof TableSchema | GeometryDataTypes;
}

interface GeometryFieldConfig extends TypedFieldConfig {
  type: 'geometry';
  typed: GeometryDataTypes;
}

interface ObjectFieldConfig extends TypedFieldConfig {
  type: 'option' | 'set' | 'array' | 'record' | 'object';
  typed?: string | BasicType | typeof TableSchema;
  properties?: PropertiesTypes;
}

type FieldConfig = PrimaryFieldConfig | BasicFieldConfig | ObjectFieldConfig | GeometryFieldConfig;

// properties types
interface PropertiesTypes {
  [keys: string]: FieldConfig;
}

/**
 * ObjectSchema
 * Represents a schema for a SurrealDB object.
 */

interface IndexSchema {
  name?: string;
  fields: string[];
  unique?: boolean;
}

type TableGenericConfig = {
  name: string;
  generic: string;
};

type TableConfig = {
  tables: (string | TableGenericConfig)[];
  schemaMode?: 'SCHEMAFULL' | 'SCHEMALESS';
  indexes?: IndexSchema[];
};

export interface SchemaObject extends TableConfig {
  properties: PropertiesTypes;
}

export class TableSchema {
  static SurrealdbSchema: SchemaObject;
}

function initializeSchema(constructor: any): void {
  if (!constructor.SurrealdbSchema) {
    constructor.SurrealdbSchema = {
      tables: [],
      properties: {},
    };
  } else if (!constructor.SurrealdbSchema.properties) {
    constructor.SurrealdbSchema.properties = {};
  }
  // Check if the class has a parent class with SurrealdbSchema
  const parentConstructor = Object.getPrototypeOf(constructor);
  if (parentConstructor?.SurrealdbSchema) {
    // Merge the parent's properties into the child's properties
    constructor.SurrealdbSchema.properties = {
      ...parentConstructor.SurrealdbSchema.properties,
      ...constructor.SurrealdbSchema.properties,
    };
  }
}

export function Field(kind: FieldType): PropertyDecorator;
export function Field(config: FieldConfig): PropertyDecorator;
export function Field(args: FieldType | FieldConfig): PropertyDecorator {
  return (target: any, propertyKey: string | symbol) => {
    if (!target || typeof propertyKey === 'undefined') {
      throw new Error('Invalid target or propertyKey in Field decorator.');
    }

    let field: FieldConfig;

    if (typeof args === 'string') {
      field = { type: args as BasicType };
    } else {
      field = { ...args };
    }

    if (
      (field.type === 'option' ||
        field.type === 'set' ||
        field.type === 'array' ||
        field.type === 'record' ||
        field.type === 'object') &&
      'typed' in field &&
      field.typed
    ) {
      if (typeof field.typed !== 'string') {
        field.properties = field.typed.SurrealdbSchema.properties || {};
      }
    }

    initializeSchema(target.constructor);

    target.constructor.SurrealdbSchema.properties[propertyKey as string] = field;
  };
}

/**
 * This will add the "name" field to the static schema object. While the name could be inferred from the class's
 * constructor, it is required because obfuscating the JS bundle in production builds changes the class names, and thus
 * produces inconsistent or duplicate SurrealDB table names.
 * @param name The table name in SurrealDB. This can be different from the class name
 */
export function Table(config: string | string[] | TableConfig): ClassDecorator {
  return (constructor: any) => {
    initializeSchema(constructor);
    if (typeof config === 'string') {
      constructor.SurrealdbSchema.tables = [config];
      constructor.SurrealdbSchema.schemaMode = 'SCHEMALESS';
    } else if (Array.isArray(config)) {
      constructor.SurrealdbSchema.tables = config;
      constructor.SurrealdbSchema.schemaMode = 'SCHEMALESS';
    } else {
      constructor.SurrealdbSchema.tables = config.tables;
      constructor.SurrealdbSchema.schemaMode = config.schemaMode ?? 'SCHEMALESS';
      constructor.SurrealdbSchema.indexes = config.indexes;
    }
  };
}

export function generateSurqlSchema<T extends typeof TableSchema>(entities: T[], comments = false) {
  const schemaParts: string[] = [];
  //
  function addFieldDefinition(
    tableName: string,
    tableGeneric: string | undefined,
    fieldName: string,
    fieldConfig: FieldSchemaProperty,
  ) {
    const fieldDefinition = [`DEFINE FIELD ${fieldName} ON ${tableName}`];
    let fieldtype: string;
    if (fieldConfig.primary) {
      fieldtype = `record<${tableName}>`;
    } else if (
      fieldConfig.type === 'option' ||
      fieldConfig.type === 'set' ||
      fieldConfig.type === 'array' ||
      fieldConfig.type === 'record' ||
      fieldConfig.type === 'object'
    ) {
      if ('typed' in fieldConfig && fieldConfig.typed) {
        if (typeof fieldConfig.typed === 'string') {
          const fieldtyped =
            fieldConfig.typed === '$$generic' ? (tableGeneric ?? 'any') : fieldConfig.typed;
          fieldtype = `${fieldConfig.type}<${fieldtyped}>`;
        } else {
          if (fieldConfig.type === 'object') {
            fieldtype = fieldConfig.type;
          } else {
            fieldtype = `${fieldConfig.type}<object>`;
          }
        }
      } else {
        fieldtype = fieldConfig.type;
      }
    } else {
      fieldtype =
        fieldConfig.type === '$$generic' ? (tableGeneric ?? 'any') : (fieldConfig.type ?? 'any');
    }

    if (fieldConfig.optional) {
      fieldDefinition.push(`TYPE option<${fieldtype}>`);
    } else {
      fieldDefinition.push(`TYPE ${fieldtype}`);
    }

    if (fieldConfig.default) {
      fieldDefinition.push(`DEFAULT ${fieldConfig.default}`);
    }
    if (fieldConfig.value) {
      fieldDefinition.push(`VALUE ${fieldConfig.value}`);
    }
    if (fieldConfig.assertion) {
      fieldDefinition.push(`ASSERT ${fieldConfig.assertion}`);
    }

    schemaParts.push(`${fieldDefinition.join(' ')};`);

    // Recursively define nested fields
    if (
      (fieldConfig.type === 'option' ||
        fieldConfig.type === 'set' ||
        fieldConfig.type === 'array' ||
        fieldConfig.type === 'record' ||
        fieldConfig.type === 'object') &&
      'properties' in fieldConfig
    ) {
      for (const [nestedFieldName, nestedFieldConfig] of Object.entries(
        fieldConfig.properties as PropertiesTypes,
      )) {
        const parentFieldName =
          fieldConfig.type === 'set' || fieldConfig.type === 'array'
            ? `${fieldName}.*.${nestedFieldName}`
            : `${fieldName}.${nestedFieldName}`;
        addFieldDefinition(tableName, tableGeneric, `${parentFieldName}`, nestedFieldConfig);
        addIndexDefinition(tableName, `${parentFieldName}`, nestedFieldConfig);
      }
    }
  }
  //
  function addIndexDefinition(
    tableName: string,
    fieldName: string,
    fieldConfig: FieldSchemaProperty,
  ) {
    if (fieldConfig.primary || fieldConfig.indexed || fieldConfig.unique) {
      const indexDefinition = [
        `DEFINE INDEX idx_${tableName}_${fieldName.replace(/[\*\.]/g, '_')} ON ${tableName} FIELDS ${fieldName}`,
      ];

      if (fieldConfig.primary || fieldConfig.unique) indexDefinition.push('UNIQUE');

      schemaParts.push(`${indexDefinition.join(' ')};`);
    }
  }
  //
  function addTableIndexes(tableName: string, indexes?: IndexSchema[]) {
    indexes?.forEach(index => {
      const indexDefinition = [
        `DEFINE INDEX ${index.name ?? `idx_${tableName}_${index.fields.join('_')}`} ON ${tableName} FIELDS ${index.fields.join(', ')}`,
      ];

      if (index.unique) indexDefinition.push('UNIQUE');

      schemaParts.push(`${indexDefinition.join(' ')};`);
    });
  }
  // start schema generation
  for (const entity of entities) {
    const { tables, schemaMode, indexes, properties } = entity.SurrealdbSchema;

    for (const table of tables) {
      let tableName: string;
      let tableGeneric: string | undefined;

      if (typeof table === 'string') {
        tableName = table;
        tableGeneric = undefined;
      } else {
        tableName = table.name;
        tableGeneric = table.generic;
      }

      if (comments) {
        schemaParts.push('-- ------------------------------');
        schemaParts.push(`-- TABLE: ${tableName}`);
        schemaParts.push('-- ------------------------------\n');
      }

      // Begin table definition
      schemaParts.push(`DEFINE TABLE ${tableName} ${schemaMode};`);
      if (comments) schemaParts.push('');

      // Define fields & indexes
      for (const [fieldName, fieldConfig] of Object.entries(properties)) {
        // Define field
        addFieldDefinition(tableName, tableGeneric, fieldName, fieldConfig);

        // Define index
        addIndexDefinition(tableName, fieldName, fieldConfig);
      }

      // Define table indexes
      addTableIndexes(tableName, indexes);

      // Separate each table definition
      schemaParts.push('\n');
    }
  }

  return schemaParts.join('\n');
}

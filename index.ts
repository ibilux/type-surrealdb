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
type ObjectType = 'object';
type TypedType = 'geometry' | 'option' | 'set' | 'array' | 'record';
type FieldType = BasicType | ObjectType | TypedType;
type GeometryDataTypes =
  | 'feature'
  | 'point'
  | 'LineString'
  | 'polygon'
  | 'multipoint'
  | 'multiline'
  | 'multipolygon'
  | 'collection';
type OptionalDataTypes = 'number' | undefined;
type SetDataTypes = BasicType | undefined;
type ArrayDataTypes = BasicType | string | undefined;
type RecordDataTypes = string | undefined;

/**
 * FieldSchemaProperty
 * Represents a property within a SurrealDB schema.
 */
interface FieldSchemaProperty {
  type?: BasicType | ObjectType | TypedType;
  default?: string;
  value?: string;
  assertion?: string;
  indexed?: boolean;
  unique?: boolean;
  primary?: boolean;
}

interface PrimaryFieldConfig extends FieldSchemaProperty {
  primary: boolean;
}

interface ObjectFieldConfig extends FieldSchemaProperty {
  type: ObjectType;
  object: typeof TableSchema;
  properties?: PropertiesTypes;
}

interface BasicFieldConfig extends FieldSchemaProperty {
  type: BasicType;
}

interface TypedFieldConfig extends FieldSchemaProperty {
  type: TypedType;
  typed: GeometryDataTypes | OptionalDataTypes | SetDataTypes | ArrayDataTypes | RecordDataTypes;
}

interface GeometryFieldConfig extends TypedFieldConfig {
  type: 'geometry';
  typed: GeometryDataTypes;
}

interface OptionalFieldConfig extends TypedFieldConfig {
  type: 'option';
  typed: OptionalDataTypes;
}

interface SetFieldConfig extends TypedFieldConfig {
  type: 'set';
  typed: SetDataTypes;
  length: number | undefined;
}

interface ArrayFieldConfig extends TypedFieldConfig {
  type: 'array';
  typed: ArrayDataTypes;
  length: number | undefined;
}

interface RecordFieldConfig extends TypedFieldConfig {
  type: 'record';
  typed: RecordDataTypes;
}

type FieldConfig =
  | PrimaryFieldConfig
  | BasicFieldConfig
  | ObjectFieldConfig
  | GeometryFieldConfig
  | OptionalFieldConfig
  | SetFieldConfig
  | ArrayFieldConfig
  | RecordFieldConfig;

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

  // Process nested objects
  for (const [_key, value] of Object.entries(
    constructor.SurrealdbSchema.properties as FieldSchemaProperty,
  )) {
    if (value.type === 'object' && value.object) {
      // Ensure that nested schemas are initialized
      initializeSchema(value.object);
    }
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

    if (field.type === 'object' && 'object' in field) {
      field.properties = field.object.SurrealdbSchema.properties || {};
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
    if (fieldConfig.primary) {
      fieldDefinition.push(`TYPE record<${tableName}>`);
    } else if (fieldConfig.type === 'object' && 'properties' in fieldConfig) {
      fieldDefinition.push(`TYPE object`);
    } else if ('typed' in fieldConfig && fieldConfig.typed) {
      const fieldtyped = fieldConfig.typed === '$$generic' ? tableGeneric : fieldConfig.typed;
      fieldDefinition.push(`TYPE ${fieldConfig.type}<${fieldtyped}>`);
    } else {
      const fieldtype = fieldConfig.type === '$$generic' ? tableGeneric : fieldConfig.type;
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
    if (fieldConfig.type === 'object' && 'properties' in fieldConfig) {
      for (const [nestedFieldName, nestedFieldConfig] of Object.entries(
        fieldConfig.properties as PropertiesTypes,
      )) {
        addFieldDefinition(
          tableName,
          tableGeneric,
          `${fieldName}.${nestedFieldName}`,
          nestedFieldConfig,
        );
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
        `DEFINE INDEX idx_${tableName}_${fieldName} ON ${tableName} FIELDS ${fieldName}`,
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

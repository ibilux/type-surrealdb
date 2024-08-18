import { Table, Field, generateSurqlSchema, TableSchema, type SchemaObject } from '../index';

describe('SurrealDB Schema Decorators and Functions', () => {

  @Table('person')
  class Person extends TableSchema {
    @Field('string')
    name!: string;

    @Field({ type: 'string', primary: true })
    id!: string;

    static SurrealdbSchema: SchemaObject;
  }

  @Table({
    tables: [{ name: 'company', generic: 'string' }],
    schemaMode: 'SCHEMAFULL',
    indexes: [
      { name: 'idx_name', fields: ['name'], unique: true },
    ]
  })
  class Company extends TableSchema {
    @Field('string')
    name!: string;

    @Field('string')
    description!: string;

    static SurrealdbSchema: SchemaObject;
  }

  @Table('address')
  class Address extends TableSchema {
    @Field('string')
    city!: string;

    @Field('string')
    postcode!: string;

    static SurrealdbSchema: SchemaObject;
  }

  describe('Field Decorator', () => {
    it('should correctly define the properties in the schema', () => {
      expect(Person.SurrealdbSchema).toBeDefined();
      expect(Person.SurrealdbSchema.properties.name).toEqual({ type: 'string' });
      expect(Person.SurrealdbSchema.properties.id).toEqual({ type: 'string', primary: true });
    });

    it('should merge properties from parent classes', () => {
      @Table('student')
      class Student extends Person {
        @Field('int')
        grade!: number;

        static SurrealdbSchema: SchemaObject;
      }

      expect(Student.SurrealdbSchema.properties.name).toBeDefined(); // Inherited
      expect(Student.SurrealdbSchema.properties.id).toBeDefined(); // Inherited
      expect(Student.SurrealdbSchema.properties.grade).toEqual({ type: 'int' });
    });
  });

  describe('Table Decorator', () => {
    it('should correctly define table configurations', () => {
      expect(Person.SurrealdbSchema.tables).toEqual(['person']);
      expect(Person.SurrealdbSchema.schemaMode).toBe('SCHEMALESS');

      expect(Company.SurrealdbSchema.tables).toEqual([{ name: 'company', generic: 'string' }]);
      expect(Company.SurrealdbSchema.schemaMode).toBe('SCHEMAFULL');
      expect(Company.SurrealdbSchema.indexes).toEqual([
        { name: 'idx_name', fields: ['name'], unique: true },
      ]);
    });
  });

  describe('generateSurqlSchema', () => {
    it('should generate valid SurrealDB schema for a simple table', () => {
      const schema = generateSurqlSchema([Person]);
      const expectedSchema = `
DEFINE TABLE person SCHEMALESS;
DEFINE FIELD name ON person TYPE string;
DEFINE FIELD id ON person TYPE record<person>;
DEFINE INDEX idx_person_id ON person FIELDS id UNIQUE;
      `.trim();

      expect(schema.trim()).toBe(expectedSchema);
    });

    it('should generate valid SurrealDB schema for a table with indexes', () => {
      const schema = generateSurqlSchema([Company]);
      const expectedSchema = `
DEFINE TABLE company SCHEMAFULL;
DEFINE FIELD name ON company TYPE string;
DEFINE FIELD description ON company TYPE string;
DEFINE INDEX idx_name ON company FIELDS name UNIQUE;
      `.trim();

      expect(schema.trim()).toBe(expectedSchema);
    });

    it('should generate valid SurrealDB schema for a table with nested fields', () => {
      @Table('employee')
      class Employee extends TableSchema {
        @Field({ type: 'object', typed: Address })
        address!: Address;

        static SurrealdbSchema: SchemaObject;
      }

      const schema = generateSurqlSchema([Employee]);
      const expectedSchema = `
DEFINE TABLE employee SCHEMALESS;
DEFINE FIELD address ON employee TYPE object;
DEFINE FIELD address.city ON employee TYPE string;
DEFINE FIELD address.postcode ON employee TYPE string;
      `.trim();

      expect(schema.trim()).toBe(expectedSchema);
    });
  });

});

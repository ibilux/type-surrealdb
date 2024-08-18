# TypeSurrealDB

![NPM Version](https://img.shields.io/npm/v/type-surrealdb) ![License](https://img.shields.io/github/license/ibilux/type-surrealdb) ![Issues](https://img.shields.io/github/issues/ibilux/type-surrealdb)

![ ](https://github.com/ibilux/type-surrealdb/raw/main/coverage/badge-statements.svg) ![ ](https://github.com/ibilux/type-surrealdb/raw/main/coverage/badge-branches.svg) ![ ](https://github.com/ibilux/type-surrealdb/raw/main/coverage/badge-functions.svg) ![ ](https://github.com/ibilux/type-surrealdb/raw/main/coverage/badge-lines.svg)

TypeSurrealDB lets you create schemas for SurrealDB using TypeScript classes and decorators!

## Features

- **Schema-First Approach:** Define your database schema using classes.
- **Type-Safety:** Strong typing with TypeScript helps catch schema issues during development.
- **Decorators:** Simple decorators for defining fields and tables in SurrealDB.

## Installation

```bash
npm install type-surrealdb
```

## Basic Usage

Instead of manually defining your SurrealDB schemas, you can use TypeSurrealDB's decorators for a more seamless experience.

To define SurrealDB object schema using TypeSurrealDB, you can utilize TypeScript classes with decorators. Each class must include a static `SurrealdbSchema: SchemaObject` property.

Here’s how you can define a basic schema:

```ts
import { Table, Field, TableSchema } from 'type-surrealdb';

@Table('car')
class Car {
  @Field({ primary: true })
  id!: string;

  @Field('string')
  make!: string;

  @Field('string')
  model!: string;

  @Field({ type: 'int', default: '0' })
  miles = 0;

  static SurrealdbSchema: SchemaObject;

  get carName() {
    return `${this.make} ${this.model}`;
  }
}
```

### Explanation

- **`@Table('car')`**: Specifies the SurrealDB table name.
- **`@Field`**: Declares the field types and configurations.
- **`static SurrealdbSchema`**: Each class must include this static member to define its schema.

### Defining Schema

In the above example, we defined a `car` schema using the `@Table` and `@Field` decorators. This generates a schema compatible with SurrealDB. The schema is derived directly from the class structure and field annotations.

### Example SurrealDB Schema Output

The resulting schema would be:

```surql
DEFINE TABLE car SCHEMALESS;
DEFINE FIELD id ON car TYPE record<car>;
DEFINE INDEX idx_car_id ON car FIELDS id UNIQUE;
DEFINE FIELD make ON car TYPE string;
DEFINE FIELD model ON car TYPE string;
DEFINE FIELD miles ON car TYPE int DEFAULT 0;
```

You can then generate the SurrealDB schema for all your entities with:

```ts
import { generateSurqlSchema } from 'type-surrealdb';

const schema = generateSurqlSchema([Car]);
console.log(schema);
```

## Advanced Usage

You can also use more advanced features like object types, typed fields, and complex schema generation. Stay tuned for more examples and detailed documentation.

Since this library is written in TypeScript, all editors with some form of intellisense should also be able to provide strongly types suggestions for the decorators as well!

This library is fully tested using JEST. You can find an example test case in the `__tests__` folder. For more advanced usage, checkout the [example](https://github.com/ibilux/type-surrealdb/tree/main/__tests__/TypeSurrealDB.test.ts)!

### Nested Objects

You can define nested objects within your schema by specifying an object type.

```ts
class Address {
  @Field('string')
  street!: string;

  @Field('string')
  city!: string;

  @Field({type: 'record', typed: 'country'})
  country!: string;

  static SurrealdbSchema: SchemaObject;
}

@Table('person')
class Person {
  @Field('uuid')
  id!: string;

  @Field('string')
  name!: string;

  @Field({ type: 'object', typed: Address })
  address!: Address;

  static SurrealdbSchema: SchemaObject;
}
```

The generated schema will reflect the nested structure:
```surql
DEFINE TABLE person SCHEMALESS;
DEFINE FIELD id ON person TYPE uuid;
DEFINE FIELD name ON person TYPE string;
DEFINE FIELD address ON person TYPE object;
DEFINE FIELD address.street ON person TYPE string;
DEFINE FIELD address.city ON person TYPE string;
DEFINE FIELD address.country ON person TYPE record<country>;
```

### Arrays and Sets

TypeSurrealDB allows you to define arrays and sets in your schema.

```ts
@Table('library')
class Book {
  @Field('string')
  title!: string;

  @Field({ type: 'array', typed: 'string' })
  authors!: string[];

  @Field({ type: 'set', typed: 'number' })
  tags!: Set<number>;
}
```

This schema will handle collections:
```surql
DEFINE TABLE library SCHEMALESS;
DEFINE FIELD title ON library TYPE string;
DEFINE FIELD authors ON library TYPE array<string>;
DEFINE FIELD tags ON library TYPE set<number>;
```

### Indexes

You can add indexes to your schema by defining them either in the field configuration or directly at the table level.

```ts
@Table({
  tables: ['Product'],
  indexes: [{ name: 'idx_product_ref', fields: ['ref1', 'ref2'], unique: true }]
})
class Product {
  @Field('string')
  ref1!: string;

  @Field('string')
  ref2!: string;

  @Field({ type: 'string', indexed: true })
  name!: string;

  @Field('decimal')
  price!: number;
}
```

This generates:
```surql
DEFINE TABLE product SCHEMALESS;
DEFINE FIELD name ON product TYPE string;
DEFINE INDEX idx_product_name ON product FIELDS name UNIQUE;
DEFINE FIELD ref1 ON product TYPE string;
DEFINE FIELD ref2 ON product TYPE string;
DEFINE FIELD price ON product TYPE decimal;
DEFINE INDEX idx_product_ref ON product FIELDS ref1, ref2 UNIQUE;
```

### Generic Types

TypeSurrealDB supports generic types, allowing you to create reusable schema components.

```ts
@Table([{ name: 'test1', generic: 'number' }, { name: 'test2', generic: 'string' }])
class Test<T> {
  @Field({ type: '$$generic' })
  val!: T;
  @Field({ type: 'record', typed: '$$generic' })
  link!: T;
}
```

This generates:
```surql
DEFINE TABLE test1 SCHEMALESS;
DEFINE FIELD val ON test1 TYPE number;
DEFINE FIELD link ON test1 TYPE record<number>;

DEFINE TABLE test2 SCHEMALESS;
DEFINE FIELD val ON test2 TYPE string;
DEFINE FIELD link ON test2 TYPE record<string>;
```

This can be reused in multiple contexts, substituting different types.

## Documentation

Check out the official SurrealDB [JavaScript SDK documentation](https://surrealdb.com/docs/sdk/javascript/core/initialization) for more context on working with SurrealDB.

## More Examples
Coming soon.

## Credits
[ibilux](https://github.com/ibilux)

import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('workspaces', (table) => {
    table
      .enum('defaultProjectRole', ['stream:reviewer', 'stream:contributor'])
      .notNullable()
      .defaultTo('stream:contributor')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('workspaces', (table) => {
    table.dropColumn('defaultProjectRole')
  })
}

import mysql from "mysql2/promise";
import { AssetManager as V1 } from "./v1";
import * as uuid from "uuid";
import { IAsset } from "./assets";

export class AssetManager extends V1 {
  constructor(pool: mysql.Pool) {
    super(pool);
  }

  async migration(): Promise<void> {
    this.withTransaction(async (conn) => {
      await conn.query(
        `
          ALTER TABLE assets 
          ADD COLUMN source_id VARCHAR(255);
        `
      );

      await conn.query(
        `
          CREATE TABLE IF NOT EXISTS sources 
          (
              id VARCHAR(255) PRIMARY KEY,
              name VARCHAR(255)
          )
        `
      );
    });
  }

  async createAsset(asset: IAsset): Promise<IAsset> {
    const { id, name, source } = asset;

    await this.withTransaction(async (conn) => {
      await this.insertSourceIfNotExist(conn, source);
      await conn.query(
        `
          INSERT INTO assets (id, name, source, source_id)
          SELECT ?, ?, ?, id
          FROM sources
          WHERE name = ?;
        `,
        [id, name, source, source]
      );
    });
    return asset;
  }

  async updateSourceByID(id: string, source: string): Promise<void> {
    await this.withTransaction(async (conn) => {
      await this.insertSourceIfNotExist(conn, source);
      await conn.query(
        `
          UPDATE assets a
          JOIN (
            SELECT id, name, ? as asset_id 
            FROM sources 
            WHERE name = ?
          ) AS s
          ON 
            s.asset_id = a.id
          SET 
            a.source_id = s.id,
            a.source = s.name;
        `,
        [id, source]
      );
    });
  }

  async insertSourceIfNotExist(
    conn: mysql.PoolConnection,
    source: string
  ): Promise<void> {
    await conn.query(
      `
        INSERT INTO sources (id, name)
        SELECT ?, ?
        FROM DUAL
        WHERE NOT EXISTS (SELECT 1 FROM sources WHERE name = ?);
      `,
      [uuid.v4(), source, source]
    );
  }
}
/* Target-client version identity bridge during the strangler migration.
   Keep these values aligned with the authoritative legacy APP_VERSION / CURRENT_SCHEMA_VERSION until
   version identity itself is extracted into a shared bootstrap owned by the target architecture. */
window.AMO_VERSION=Object.freeze({client:'1.2.2',schema:3});

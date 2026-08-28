targetScope = 'resourceGroup'

@description('Azure region for all AMO resources.')
param location string = resourceGroup().location

@description('Short application prefix, for example amo. Lowercase letters/numbers/hyphens are recommended.')
param namePrefix string

@description('Allowed browser origin for the AMO API CORS policy.')
param allowedOrigin string = 'https://amo.theflat.me.uk'

@description('Initial image used only while bootstrapping the Container App. GitHub Actions replaces it with the AMO API image.')
param bootstrapImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Remote persistence implementation. mongo is the Azure default; json retains the Azure Files proof as an explicit fallback.')
@allowed([
  'mongo'
  'json'
])
param repositoryMode string = 'mongo'

var compactPrefix = toLower(replace(namePrefix, '-', ''))
var globalSuffix = uniqueString(subscription().subscriptionId, resourceGroup().id)
var acrName = take('${compactPrefix}acr${globalSuffix}', 50)
var storageAccountName = take('${compactPrefix}data${globalSuffix}', 24)
var cosmosAccountName = take('${compactPrefix}-mongo-${globalSuffix}', 44)
var mongoDatabaseName = 'amo'
var documentsCollectionName = 'amoDocuments'
var runtimeCollectionName = 'amoRuntime'
var fileShareName = 'amo-workspace'
var environmentName = '${namePrefix}-env'
var containerAppName = '${namePrefix}-api'
var environmentStorageName = take('amoworkspace${globalSuffix}', 32)
var workspaceMountPath = '/data/workspace'
var acrPullRoleDefinitionId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

// Retained as the explicit JSON repository fallback and for future JSON import/export.
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource workspaceShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  parent: fileService
  name: fileShareName
  properties: {
    enabledProtocols: 'SMB'
    accessTier: 'TransactionOptimized'
  }
}

// Serverless Mongo API keeps the personal/test AMO footprint pay-per-use. The main collection is
// deliberately unsharded because Cosmos Mongo multi-document transactions are collection-scoped.
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: cosmosAccountName
  location: location
  kind: 'MongoDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    apiProperties: {
      serverVersion: '7.0'
    }
    capabilities: [
      {
        name: 'EnableMongo'
      }
      {
        name: 'EnableServerless'
      }
      {
        name: 'EnableTtlOnCustomPath'
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    backupPolicy: {
      type: 'Continuous'
      continuousModeProperties: {
        tier: 'Continuous7Days'
      }
    }
    publicNetworkAccess: 'Enabled'
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
  }
}

resource mongoDatabase 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2024-11-15' = {
  parent: cosmos
  name: mongoDatabaseName
  properties: {
    resource: {
      id: mongoDatabaseName
    }
    options: {}
  }
}

resource documentsCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2024-11-15' = {
  parent: mongoDatabase
  name: documentsCollectionName
  properties: {
    resource: {
      id: documentsCollectionName
      indexes: [
        {
          key: {
            keys: [
              '_id'
            ]
          }
        }
        {
          key: {
            keys: [
              'documentType'
              'entityId'
            ]
          }
        }
        {
          key: {
            keys: [
              'documentType'
              'timestamp'
            ]
          }
        }
        {
          key: {
            keys: [
              'expiresAt'
            ]
          }
          options: {
            expireAfterSeconds: 0
          }
        }
      ]
    }
    options: {}
  }
}

resource runtimeCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2024-11-15' = {
  parent: mongoDatabase
  name: runtimeCollectionName
  properties: {
    resource: {
      id: runtimeCollectionName
      indexes: [
        {
          key: {
            keys: [
              '_id'
            ]
          }
        }
      ]
    }
    options: {}
  }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  properties: {}
}

resource environmentStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: environment
  name: environmentStorageName
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: storage.listKeys().keys[0].value
      shareName: workspaceShare.name
      accessMode: 'ReadWrite'
    }
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: containerAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'mongo-connection'
          value: cosmos.listConnectionStrings().connectionStrings[0].connectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'amo-api'
          image: bootstrapImage
          env: [
            {
              name: 'PORT'
              value: '8080'
            }
            {
              name: 'AMO_REPOSITORY'
              value: repositoryMode
            }
            {
              name: 'AMO_MONGO_DATABASE'
              value: mongoDatabaseName
            }
            {
              name: 'AMO_MONGO_CONNECTION_STRING'
              secretRef: 'mongo-connection'
            }
            {
              name: 'AMO_WORKSPACE_ROOT'
              value: workspaceMountPath
            }
            {
              name: 'AMO_ALLOWED_ORIGINS'
              value: allowedOrigin
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          volumeMounts: [
            {
              volumeName: 'workspace'
              mountPath: workspaceMountPath
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
      }
      volumes: [
        {
          name: 'workspace'
          storageType: 'AzureFile'
          storageName: environmentStorage.name
        }
      ]
    }
  }
  dependsOn: [
    documentsCollection
    runtimeCollection
  ]
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, app.id, 'AcrPull')
  scope: registry
  properties: {
    roleDefinitionId: acrPullRoleDefinitionId
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output acrName string = registry.name
output acrLoginServer string = registry.properties.loginServer
output containerAppName string = app.name
output containerAppFqdn string = app.properties.configuration.ingress.fqdn
output storageAccountName string = storage.name
output fileShareName string = workspaceShare.name
output workspaceMountPath string = workspaceMountPath
output repositoryMode string = repositoryMode
output cosmosAccountName string = cosmos.name
output mongoDatabaseName string = mongoDatabase.name
output mongoBackupPolicy string = 'Continuous7Days'

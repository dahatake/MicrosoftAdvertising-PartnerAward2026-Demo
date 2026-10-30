param location string
param environmentName string
param image string
param authClientId string
@secure()
param authClientSecret string
param authTenantId string
param tags object

var token = toLower(uniqueString(subscription().id, environmentName, location))
var appName = 'ca-web-${take(token, 6)}'

// Observability: console logs and platform logs go to Log Analytics (one JSON line per request from the app).
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${token}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// Workload identity: pulls the image from ACR without admin credentials.
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${token}'
  location: location
  tags: tags
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'cr${token}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

var acrPullRole = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
resource pull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, acrPullRole)
  scope: registry
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRole)
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${token}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [ { name: 'Consumption', workloadProfileType: 'Consumption' } ]
    zoneRedundant: false
  }
}

var fqdn = '${appName}.${env.properties.defaultDomain}'

resource web 'Microsoft.App/containerApps@2024-03-01' = {
  name: appName
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  dependsOn: [ pull ]
  properties: {
    managedEnvironmentId: env.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [ { server: registry.properties.loginServer, identity: identity.id } ]
      secrets: [ { name: 'microsoft-provider-authentication-secret', value: authClientSecret } ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: image
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'APP_REMOTE_HOSTS', value: fqdn }
            { name: 'APP_DB', value: '/tmp/app.db' }
          ]
          probes: [
            { type: 'Startup', httpGet: { path: '/healthz', port: 8000 }, periodSeconds: 2, failureThreshold: 30, timeoutSeconds: 2 }
            { type: 'Liveness', httpGet: { path: '/healthz', port: 8000 }, periodSeconds: 10, failureThreshold: 3, timeoutSeconds: 5, initialDelaySeconds: 10 }
            { type: 'Readiness', httpGet: { path: '/healthz', port: 8000 }, periodSeconds: 5, failureThreshold: 3, timeoutSeconds: 3 }
          ]
        }
      ]
      // One replica on purpose: the demo DB is per-instance SQLite guarded by an in-process lock.
      scale: { minReplicas: 1, maxReplicas: 1 }
    }
  }
}

// Built-in authentication (Entra ID, single tenant). Unauthenticated requests are redirected to sign-in.
resource auth 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  parent: web
  name: 'current'
  properties: {
    platform: { enabled: true }
    globalValidation: {
      unauthenticatedClientAction: 'RedirectToLoginPage'
      redirectToProvider: 'azureactivedirectory'
      excludedPaths: [ '/healthz' ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: authClientId
          clientSecretSettingName: 'microsoft-provider-authentication-secret'
          openIdIssuer: '${environment().authentication.loginEndpoint}${authTenantId}/v2.0'
        }
        validation: { allowedAudiences: [ authClientId, 'api://${authClientId}' ] }
      }
    }
    login: { preserveUrlFragmentsForLogins: true }
  }
}

output registryEndpoint string = registry.properties.loginServer
output registryName string = registry.name
output uri string = 'https://${fqdn}'
output redirectUri string = 'https://${fqdn}/.auth/login/aad/callback'

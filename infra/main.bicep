targetScope = 'subscription'

@minLength(1)
@maxLength(20)
@description('Environment name used to derive resource names and tags (azd environment name).')
param environmentName string

@minLength(1)
@description('Azure region for all resources.')
param location string

@description('Container image. azd sets SERVICE_WEB_IMAGE_NAME after the first deploy; until then a placeholder is used.')
param image string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Client (application) ID of the Microsoft Entra app registration used by built-in authentication. Anonymous access is not allowed.')
@minLength(1)
param authClientId string

@secure()
@description('Client secret of that app registration (stored as a Container Apps secret; move to Key Vault for production).')
param authClientSecret string

@description('Entra tenant that is allowed to sign in (single-tenant).')
param authTenantId string = tenant().tenantId

var tags = { 'azd-env-name': environmentName, workload: 'campaign-flow-demo', dataClass: 'fictitious-demo' }

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module app 'app.bicep' = {
  name: 'app'
  scope: rg
  params: {
    location: location
    environmentName: environmentName
    image: image
    authClientId: authClientId
    authClientSecret: authClientSecret
    authTenantId: authTenantId
    tags: tags
  }
}

output AZURE_LOCATION string = location
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = app.outputs.registryEndpoint
output AZURE_CONTAINER_REGISTRY_NAME string = app.outputs.registryName
output SERVICE_WEB_URI string = app.outputs.uri
output SERVICE_WEB_REDIRECT_URI string = app.outputs.redirectUri

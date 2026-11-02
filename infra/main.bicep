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

@description('Monthly budget for the resource group, in the billing currency of the subscription (100,000 = JPY 100,000 for a JPY account).')
param monthlyBudget int = 100000

@description('Email that receives budget alerts.')
param budgetContactEmail string

@description('First day of the current month (budget start). Must be the first of a month.')
param budgetStartDate string = utcNow('yyyy-MM-01')

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
    monthlyBudget: monthlyBudget
    budgetContactEmail: budgetContactEmail
    budgetStartDate: budgetStartDate
    tags: tags
  }
}

output AZURE_LOCATION string = location
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = app.outputs.registryEndpoint
output AZURE_CONTAINER_REGISTRY_NAME string = app.outputs.registryName
output SERVICE_WEB_URI string = app.outputs.uri

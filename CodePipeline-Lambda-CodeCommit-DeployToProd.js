const AWS = require('aws-sdk');
var jobId
var commitId = '4aae84ccb0c0d59d9aa133dc85f076357993822c' 
var repositoryName = 'MF-AWS-CICD-SCM'
var jobUserParameters   
var differencesData
var difference


exports.handler = async (event, context) => {
    var codepipeline = new AWS.CodePipeline()
    var codecommit = new AWS.CodeCommit()

    console.log('Received event ', JSON.stringify(event))
    try {
        jobId = event["CodePipeline.job"].id
        console.log('Found CodePipeline job with ID: ', jobId)
        jobUserParameters = JSON.parse(event["CodePipeline.job"].data.actionConfiguration.configuration.UserParameters)
        console.log('Found CodePipeline job with parameters: ', jobUserParameters)
        commitId = jobUserParameters.commitId
        console.log('Found CodeCommit CommitId: ', commitId)
        repositoryName = jobUserParameters.repositoryName
        console.log('Found CodeCommit RepositoryName: ', repositoryName)
        if ((!commitId) || (!repositoryName) ) { console.error('Error trying to retrieve CodePipeline user parameters. In CodePipeline, the User Parameters must be { "commitId": "#{SourceVariables.CommitId}", "repositoryName": "#{SourceVariables.RepositoryName}" }.') }
    } catch (error) {
        console.error('Error trying to retrieve CodePipeline parameters. In CodePipeline, the User Parameters must be { "commitId": "#{SourceVariables.CommitId}", "repositoryName": "#{SourceVariables.RepositoryName}" }. Continuing with default Lambda function values. Catched error: ', error.toString())
    }

    try {
            
        console.log('commitId:', commitId)
        const commitData = await codecommit.getCommit({ commitId: commitId, repositoryName: repositoryName }).promise()
        //console.log(commitData)
        console.log('Commit message:', commitData.commit.message)
        if (commitData.commit.parents[0].length > 0) { 
            const priorCommitId = commitData.commit.parents[0] 
            console.log('priorCommitId:', priorCommitId)
            differencesData = await codecommit.getDifferences({ repositoryName: repositoryName, afterCommitSpecifier: commitId, beforeCommitSpecifier: priorCommitId }).promise()
        } else {
            differencesData = await codecommit.getDifferences({ repositoryName: repositoryName, afterCommitSpecifier: commitId }).promise()
        }
        //console.log('differencesData:', differencesData)
 
        for (difference of differencesData.differences) {
            //console.log('Processing difference:', difference)
            if (difference.changeType == 'A') {
                console.log('Processing DeployToProd file add:', difference.afterBlob.path )
                console.log('Processing DeployToProd file add with blobId:', difference.afterBlob.blobId )
                const blobData = await codecommit.getBlob({ blobId: difference.afterBlob.blobId, repositoryName: repositoryName }).promise()
                const blobContent = blobData.content
                console.log('blobContent:', blobContent)
                // Add your code addition logic here
        
            } else if (difference.changeType == 'M') {
                console.log('Processing DeployToProd file modify:', difference.afterBlob.path )
                console.log('Processing DeployToProd file modify with blobId:', difference.afterBlob.blobId )
                const blobData = await codecommit.getBlob({ blobId: difference.afterBlob.blobId, repositoryName: repositoryName }).promise()
                const blobContent = blobData.content
                console.log('blobContent:', blobContent)
                // Add your code modification logic here

            } else if (difference.changeType == 'D') {
                console.log('Processing DeployToProd file delete:', difference.afterBlob.path )
                console.log('Processing DeployToProd file delete with blobId:', difference.afterBlob.blobId )
                // Add your code deletion logic here
                
            } else {
                console.log('changeTyoe not processed: ', difference.changeType)
            }
        }


        if (jobId) {
            console.log('Sending putJobSuccessResult to CodePipeline.')
            await codepipeline.putJobSuccessResult({ jobId }).promise()    
        }    

    } catch (error) {
        console.error('Error caught during Lambda function execution:', error.toString())
        if (jobId) {
                   console.log('Sending putJobFailureResult to CodePipeline.')
                   await codepipeline.putJobFailureResult({jobId, failureDetails: {message: error.toString(), type: 'JobFailed', externalExecutionId: context.invokeid}}).promise()
        } else {
           throw error 
        }
    }
}
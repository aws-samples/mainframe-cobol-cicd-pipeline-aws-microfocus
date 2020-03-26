const AWS = require('aws-sdk');
const ssm = new AWS.SSM();
const ec2 = new AWS.EC2();
const waitInterval = 1
const timeoutSSM = 300
var jobId
var jobUserParameters    

exports.handler = async (event, context) => {
    const instanceIds = [];
    var instanceTagKey = 'CodeDeployGroup'
    var instanceTagValue = 'ETS-EC2-instances-MF-AWS-CICD'
    var command = "& C:\\BankDemo\\Test\\BankDemo-Tests.bat"
    var instanceId
    var codepipeline = new AWS.CodePipeline()
    var runEc2CommandOneSuccess = false
    
    console.log('Received event ', JSON.stringify(event))
    try {
        jobId = event["CodePipeline.job"].id
        console.log('Found CodePipeline job with ID: ', jobId)
        jobUserParameters = JSON.parse(event["CodePipeline.job"].data.actionConfiguration.configuration.UserParameters)
        console.log('Found CodePipeline job with parameters: ', jobUserParameters)
        instanceTagKey = jobUserParameters.Ec2TagKey
        instanceTagValue = jobUserParameters.Ec2TagValue
        command = jobUserParameters.Ec2Command
        if ((!instanceTagKey) || (!instanceTagValue) || (!command)) { console.error('Error trying to retrieve CodePipeline user parameters. In CodePipeline, the User Parameters must be in JSON format following {"Ec2TagKey": "myTagKey", "Ec2TagValue": "myTagValue", "Ec2Command": "& C:\\myPath\\myCommand.bat"}.') }
    } catch (error) {
        console.error('Error trying to retrieve CodePipeline parameters. In CodePipeline, the User Parameters must be in JSON format following {"Ec2TagKey": "myTagKey", "Ec2TagValue": "myTagValue", "Ec2Command": "& C:\\myPath\\myCommand.bat"}. Continuing with default Lambda function values. Catched error: ', error.toString())
    }
    try {
            
            var tagFilter = { Filters: [ { Name: 'tag:' + instanceTagKey, Values: [ instanceTagValue ] } ] };
            const instancesData = await ec2.describeInstances(tagFilter).promise();
            instancesData.Reservations.forEach(reservation => {
                reservation.Instances.forEach(instance => {
                    //console.log('Looking at instance: ', instance.InstanceId)
                    if (instance.State.Code === 16) {
                        // 0: pending, 16: running, 32: shutting-down, 48: terminated, 64: stopping, 80: stopped
                        instanceIds.push(instance.InstanceId);
                        console.log('Instance found running with tag { ' + instanceTagKey + ': ' + instanceTagValue + ' } :', instance.InstanceId)
                    }
                 });
            });
            //console.log('instanceIds: ', instanceIds)
            if (instanceIds.length == 0) {
                 console.error('No instance found with status Running and tag { ', instanceTagKey, ': ', instanceTagValue , ' }')
            } else {

                for (instanceId of instanceIds) {
                    // Send command to EC2 instance via SSM
                    const sendCommandPromise = ssm.sendCommand({
                           DocumentName: "AWS-RunPowerShellScript",
                           InstanceIds: [ instanceId ],
                           Parameters: {  "commands": [ command ], "workingDirectory": [  "" ] },
                           TimeoutSeconds: timeoutSSM
                           }).promise();
                    console.log(instanceId, ' - SSM command sent to instance')
                    console.log(instanceId, ' - PowerShell command sent: ', command)
                    const sendCommandResult = await sendCommandPromise
                    const commandId = sendCommandResult.Command.CommandId
        
                    var commandStatus = ''
                    var getCommandInvocationResult
                    do {
                        console.log(instanceId, ' - Waiting for SSM response...')
                        await new Promise(resolve => setTimeout(resolve, waitInterval * 1000));
                        const getCommandInvocationPromise = ssm.getCommandInvocation({ CommandId: commandId, InstanceId: instanceId}).promise();
                        getCommandInvocationResult = await getCommandInvocationPromise
                        //console.log('getCommandInvocationResult: ', getCommandInvocationResult)
                        commandStatus = getCommandInvocationResult.Status
                        console.log(instanceId, ' - SSM command status: ', commandStatus)
                        //if (commandStatus == 'Success') { console.log('getCommandInvocationResult: ', getCommandInvocationResult) }
                    } while ((commandStatus != 'Success') && (commandStatus != 'Cancelled') && (commandStatus != 'TimedOut') && (commandStatus != 'Failed'));
                    if (commandStatus == 'Success') { 
                        if (getCommandInvocationResult.StandardErrorContent.length == 0) {
                            runEc2CommandOneSuccess = true
                            console.log(instanceId, ' - Command successfully executed via SSM.')
                            console.log(instanceId, ' - Command StdOut: ', getCommandInvocationResult.StandardOutputContent)
                            console.log(instanceId, ' - Command StdErr: ', getCommandInvocationResult.StandardErrorContent)
                        } else {
                            console.error(instanceId, ' - Command executed via SSM, but generated an error.')
                            console.error(instanceId, ' - Command StdOut: ', getCommandInvocationResult.StandardOutputContent)
                            console.error(instanceId, ' - Command StdErr: ', getCommandInvocationResult.StandardErrorContent)
                        }
                    } else {
                        console.error(instanceId, ' - SSM command failed.')
                        console.error(instanceId, ' - SSM ResponseCode: ', getCommandInvocationResult.ResponseCode)
                        console.error(instanceId, ' - SSM Status: ', getCommandInvocationResult.Status)
                        console.error(instanceId, ' - SSM StatusDetails: ', getCommandInvocationResult.StatusDetails)
                    }     
                }
            }
        
        if (runEc2CommandOneSuccess) {
            console.log('One command execution on an EC2 instance was successful.')
            if (jobId) {
                console.log('Sending putJobSuccessResult to CodePipeline.')
                await codepipeline.putJobSuccessResult({ jobId }).promise()    
            }    
        } else {
            console.error('Command execution on EC2 instance(s) was unsuccessful.')
            if (jobId) {
                console.log('Sending putJobFailureResult to CodePipeline.')
                await codepipeline.putJobFailureResult({jobId, failureDetails: {message: 'Script error. See Command StdErr for details', type: 'JobFailed', externalExecutionId: context.invokeid}}).promise()
            }
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
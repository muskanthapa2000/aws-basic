import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
// import * as ec2 from 'aws-cdk-lib/aws-ec2';
// import * as iam from 'aws-cdk-lib/aws-iam';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class MuskanStudentManagementStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB Table (if using DynamoDB)
    const studentTable = new dynamodb.Table(this, 'MuskanStudentTable', {
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      tableName: 'MuskanStudentTable',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

     // Create DynamoDB Table for audit logs
     const auditTable = new dynamodb.Table(this, 'AuditLogTable', {
      partitionKey: { name: 'auditId', type: dynamodb.AttributeType.STRING },
      tableName: 'AuditLogTable',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Create SQS Queue for audit events
    const auditQueue = new sqs.Queue(this, 'AuditQueue', {
      retentionPeriod: cdk.Duration.days(14),
    });

    // Define the Lambda function
    const createStudentLambda = new lambda.Function(this, 'CreateStudentLambda', {
      runtime: lambda.Runtime.NODEJS_18_X, // Specify the Lambda runtime environment
      handler: 'create-student.handler',  // File is 'create-student.js', and function is 'handler'
      code: lambda.Code.fromAsset('lambda'), // Directory containing Lambda code
      environment: {
        TABLE_NAME: studentTable.tableName, // Pass the table name as an environment variable
        AUDIT_QUEUE_URL: auditQueue.queueUrl
      },
    });

 

    // Grant the Lambda function permissions to read/write to DynamoDB
    studentTable.grantReadWriteData(createStudentLambda);
    auditQueue.grantSendMessages(createStudentLambda);

    // Create an API Gateway and associate it with the Lambda function
    const api = new apigateway.RestApi(this, 'StudentManagementAPI', {
      restApiName: 'Student Management Service',
      description: 'This service manages students.',
    });

    // Define the /students resource in API Gateway
    const students = api.root.addResource('students');
    const studentId = students.addResource('{id}'); // Adding a path parameter 'id'
    students.addMethod('POST', new apigateway.LambdaIntegration(createStudentLambda));
    students.addMethod("DELETE",new apigateway.LambdaIntegration(createStudentLambda));
    students.addMethod("GET", new apigateway.LambdaIntegration(createStudentLambda));
    studentId.addMethod("DELETE", new apigateway.LambdaIntegration(createStudentLambda))
    studentId.addMethod('PUT', new apigateway.LambdaIntegration(createStudentLambda)); // For updating a student
    const writeAuditLogsLambda = new lambda.Function(this, 'WriteAuditLogsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'write-audit-logs.handler',  // Corresponds to 'lambda/write-audit-logs.js'
      code: lambda.Code.fromAsset('lambda'),
      environment: {
        AUDIT_TABLE_NAME: auditTable.tableName
      }
    });

    auditTable.grantReadWriteData(writeAuditLogsLambda);

    // Add SQS as an event source for the audit log processor Lambda
    writeAuditLogsLambda.addEventSource(new SqsEventSource(auditQueue));
  }

}

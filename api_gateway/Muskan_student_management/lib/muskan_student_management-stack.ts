import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';

export class MuskanStudentManagementStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB Table (if using DynamoDB)
    const studentTable = new dynamodb.Table(this, 'MuskanStudentTable', {
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      tableName: 'MuskanStudentTable',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Define the Lambda function
    const createStudentLambda = new lambda.Function(this, 'CreateStudentLambda', {
      runtime: lambda.Runtime.NODEJS_18_X, // Specify the Lambda runtime environment
      handler: 'create-student.handler',  // File is 'create-student.js', and function is 'handler'
      code: lambda.Code.fromAsset('lambda'), // Directory containing Lambda code
      environment: {
        TABLE_NAME: studentTable.tableName, // Pass the table name as an environment variable
      },
    });

    // Grant the Lambda function permissions to read/write to DynamoDB
    studentTable.grantReadWriteData(createStudentLambda);

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

  }

}

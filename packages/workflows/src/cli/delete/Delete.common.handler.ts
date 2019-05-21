/*
* This program and the accompanying materials are made available under the terms of the
* Eclipse Public License v2.0 which accompanies this distribution, and is available at
* https://www.eclipse.org/legal/epl-v20.html
*
* SPDX-License-Identifier: EPL-2.0
*
* Copyright Contributors to the Zowe Project.
*
*/

import { IHandlerParameters, ImperativeError } from "@brightside/imperative";
import { DeleteWorkflow } from "../../api/Delete";
import { ZosmfBaseHandler } from "../../../../zosmf/src/ZosmfBaseHandler";
import { ListWorkflows } from "../../..";
import { IActiveWorkflows } from "../../api/doc/IActiveWorkflows";
import { IWorkflowsInfo } from "../../api/doc/IWorkflowsInfo";


/**
 * Common handler to delete a workflow instance in z/OSMF.
 * This is not something that is intended to be used outside of this npm package.
 */
export default class DeleteCommonHandler extends ZosmfBaseHandler {
    /**
     * Command line arguments passed
     * @private
     * @type {*}
     * @memberof DeleteCommonHandler
     */
    private arguments: any;

    /**
     * Command handler process - invoked by the command processor to handle the "zos-workflows delete"
     * @param {IHandlerParameters} params - Command handler parameters
     * @returns {Promise<void>} - Fulfilled when the command completes successfully OR rejected with imperative error
     * @memberof DeleteCommonHandler
     */
    public async processCmd(params: IHandlerParameters): Promise<void> {
        let error;
        let resp;
        let getWfKey: IActiveWorkflows;
        this.arguments = params.arguments;

        let sourceType: string;
        if (this.arguments.workflowKey) {
            sourceType = "workflowKey";
        } else if (this.arguments.workflowName) {
            sourceType = "workflowName";
        }

        switch (sourceType) {
            case "workflowKey":
                try{
                    await DeleteWorkflow.deleteWorkflow(this.mSession, this.arguments.workflowKey);
                } catch (err){
                    error = "Delete workflow: " + err;
                    throw error;
                }
                params.response.data.setObj("Deleted.");
                params.response.console.log("Workflow deleted.");
                break;

            case "workflowName":
                    getWfKey = await ListWorkflows.listWorkflows(this.mSession, undefined, this.arguments.workflowName);
                    if (getWfKey === null || getWfKey.workflows.length === 0) {
                        throw new ImperativeError({
                            msg: `No workflows match the provided workflow name.`,
                            additionalDetails: JSON.stringify(params)
                        });
                    }
                    const failedWfs: IWorkflowsInfo[] = [];
                    let i: number = 0;
                    for(const element of getWfKey.workflows){
                        try {
                            resp = await DeleteWorkflow.deleteWorkflow(this.mSession, element.workflowKey);
                        } catch (err) {
                            getWfKey.workflows.splice(i, 1);
                            failedWfs.push(element);
                        }
                        i++;
                    }

                    params.response.data.setObj("Deleted.");

                    if(getWfKey.workflows.length > 0){
                        params.response.console.log("Workflow(s) deleted: ");
                        params.response.format.output({
                            fields: ["workflowName", "workflowKey"],
                            output: getWfKey.workflows,
                            format: "table",
                            header: true,
                        });
                    }

                    if(failedWfs.length > 0){
                        params.response.console.log("\nFailed to delete Workflow(s): ");
                        params.response.format.output({
                            fields: ["workflowName", "workflowKey"],
                            output: failedWfs,
                            format: "object",
                            header: true,
                        });
                        throw new ImperativeError({
                            msg: `Some workflows were not deleted, please check the message above.`
                        });
                    }
                    break;

            default:
            throw new ImperativeError({
                msg: `Internal create error: Unable to determine the the criteria by which to run delete workflow action. ` +
                    `Please contact support.`,
                additionalDetails: JSON.stringify(params)
                });
        }
    }
}

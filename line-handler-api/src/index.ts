import express, { Application, Request, Response } from "express";
import { CloudTasksClient } from "@google-cloud/tasks";
import { google } from "@google-cloud/tasks/build/protos/protos";
import ICreateTaskRequest = google.cloud.tasks.v2.ICreateTaskRequest;
import Task = google.cloud.tasks.v2.Task;

/**
 * LINE プッシュメッセージを送信するタスクを Cloud Tasks へ登録する
 * https://cloud.google.com/tasks/docs/dual-overview?hl=ja
 */
async function kick(): Promise<void> {
  const client = new CloudTasksClient();

  const createHttpTask = async (): Promise<void> => {
    const project = "line-bot-353103"; // GCP Project id
    const queue = "my-queue"; // キューの名前
    const location = "asia-northeast2"; // キューの region
    const url = "https://line-bot-4vbqfq4cja-dt.a.run.app/sendLineMessage"; // タスクが呼び出すURL
    const payload = "Hello, World!"; // タスク(POST) の HTTP request body
    const inSeconds = 0; // タスクを実行するまでの遅延時間

    // Construct the fully qualified queue name.
    const parent = client.queuePath(project, location, queue);

    const task: Task = Task.create({
      httpRequest: {
        httpMethod: "POST",
        url: url,
      },
    });

    if (payload && task.httpRequest) {
      task.httpRequest.body = Buffer.from(payload).toString("base64");
    }

    task.scheduleTime = {
      seconds: inSeconds + Date.now() / 1000,
    };

    // Send create task request.
    console.log("Sending task:");
    console.log(task);
    const request: ICreateTaskRequest = {
      parent: parent,
      task: task,
    };
    const [response] = await client.createTask(request);
    const name = response.name;
    if (name === null || name === undefined) {
      console.log("Created task name is null or undefined");
    } else {
      console.log(`Created task ${name}`);
    }
  };

  await createHttpTask();
}

const app: Application = express();

/*
 * Cloud Run から呼び出すURL
 */
app.get("/kick", (_req: Request, res: Response) => {
  kick().then(() => {
    console.log("createHttpTask() completed.");
  }).catch((reason) => {
    console.log("createHttpTask() error.");

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    console.log(reason.toString());

    return res.status(500).send();
  })

  return res.status(200).send();
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

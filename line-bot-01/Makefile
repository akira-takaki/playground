# Makefile に固定で書きたくない変数を読み込む
include env.txt

# Docker 関連情報
BASE_NAME=line-bot-01

# Google Cloud Platform の Artifact Registry 関連情報
REPO_LOCATION=asia-northeast2
REPOSITORY=line-bot
IMAGE=line-bot-01-image

# Google Cloud Platform の Cloud Run 関連情報
PROJECT_ID=line-bot-353103
SERVICE=line-bot
RUN_REGION=asia-northeast2


# Docker イメージを作成する
build:
	docker build --tag ${BASE_NAME} .


# Docker イメージをローカルで実行する
# http://0.0.0.0:8080/callback
run:
	docker run -e PORT=8080 -e CHANNEL_SECRET=${CHANNEL_SECRET} -e CHANNEL_TOKEN=${CHANNEL_TOKEN} -p 8080:8080 ${BASE_NAME}


# Google Cloud Platform の Artifact Registry に登録するために Docker イメージのタグを設定する
tag:
	docker tag ${BASE_NAME} ${REPO_LOCATION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE}


# Google Cloud Platform の プロジェクト を設定
set_project:
	gcloud config set project ${PROJECT_ID}


# Google Cloud Platform の リージョン を設定
set_region:
	gcloud config set compute/zone ${RUN_REGION}-a


# Google Cloud Platform の Artifact Registry のリポジトリを作成する
create_repo:
	gcloud artifacts repositories create ${REPOSITORY} --repository-format=docker --location=${REPO_LOCATION}


# Google Cloud Platform の Artifact Registry に Docker イメージを登録する
push:
	docker push ${REPO_LOCATION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE}


# Google Cloud Platform の Artifact Registry のリポジトリを削除する
delete_repo:
	gcloud artifacts repositories delete ${REPOSITORY} --location=${REPO_LOCATION}


# Google Cloud Platform の Artifact Registry のリポジトリに存在する Docker イメージを Cloud Run へデプロイする
deploy_run:
	gcloud run deploy ${SERVICE} --image ${REPO_LOCATION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${IMAGE} --platform managed --region ${RUN_REGION}


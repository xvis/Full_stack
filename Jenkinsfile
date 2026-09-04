pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        ansiColor('xterm')
    }

    environment {
        DOCKER_HUB_FRONTEND = 'xvishu/fullstack-frontend'
        DOCKER_HUB_BACKEND  = 'xvishu/fullstack-backend'
        IMAGE_TAG           = "${BUILD_NUMBER}"
    }

    stages {
        stage('Checkout') {
            steps {
                echo "=== Stage 1: Checking out repository ==="
                checkout scm
                script {
                    env.GIT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    echo "Triggered on Git commit: ${env.GIT_SHA} | Build #${env.BUILD_NUMBER}"
                }
            }
        }

        stage('Validate & Test Backend') {
            steps {
                echo "=== Stage 2: Validating Backend ==="
                dir('backend') {
                    sh 'npm ci'
                    sh 'npm test --if-present'
                }
            }
        }

        stage('Validate & Build Frontend') {
            steps {
                echo "=== Stage 3: Compiling Frontend (Angular) ==="
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                echo "=== Stage 4: Building Production Docker Images ==="
                sh """
                    docker build \
                        -t ${DOCKER_HUB_BACKEND}:${IMAGE_TAG} \
                        -t ${DOCKER_HUB_BACKEND}:latest \
                        ./backend

                    docker build \
                        -t ${DOCKER_HUB_FRONTEND}:${IMAGE_TAG} \
                        -t ${DOCKER_HUB_FRONTEND}:latest \
                        ./frontend
                """
            }
        }

        stage('Push to Registry') {
            when {
                // Only push if Docker Hub credentials are configured in Jenkins
                expression {
                    return fileExists("${WORKSPACE}/.push_enabled") || env.DOCKER_PUSH == 'true'
                }
            }
            steps {
                echo "=== Stage 5: Pushing Images to Docker Hub ==="
                withCredentials([usernamePassword(credentialsId: 'docker-hub-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh """
                        echo "\$DOCKER_PASS" | docker login -u "\$DOCKER_USER" --password-stdin
                        docker push ${DOCKER_HUB_BACKEND}:${IMAGE_TAG}
                        docker push ${DOCKER_HUB_BACKEND}:latest
                        docker push ${DOCKER_HUB_FRONTEND}:${IMAGE_TAG}
                        docker push ${DOCKER_HUB_FRONTEND}:latest
                        docker logout
                    """
                }
            }
        }

        stage('Deploy Application') {
            steps {
                echo "=== Stage 6: Deploying Application Stack ==="
                script {
                    // Phase 1: Deploy with Docker Compose
                    sh 'docker compose up -d'

                    // Health Verification
                    echo "Verifying service availability..."
                    sh '''
                        for i in $(seq 1 12); do
                            if curl -sf http://localhost:4200/health > /dev/null && curl -sf http://localhost:3000/api/health > /dev/null; then
                                echo "All application services are healthy!"
                                exit 0
                            fi
                            echo "Waiting for services to become healthy... ($i/12)"
                            sleep 5
                        done
                        echo "Health verification timed out!"
                        docker compose ps
                        exit 1
                    '''

                    // Phase 2 (Kubernetes Runway):
                    // In Phase 2, this step will execute:
                    // sh 'kubectl apply -f k8s/'
                    // sh 'kubectl rollout status deployment/frontend'
                    // sh 'kubectl rollout status deployment/backend'
                }
            }
        }
    }

    post {
        success {
            echo " Pipeline Succeeded! NexaFlow is live at http://localhost:4200"
        }
        failure {
            echo " Pipeline Failed! Please check the stage logs above."
        }
        always {
            cleanWs(cleanWhenNotBuilt: false, deleteDirs: true, notFailBuild: true)
        }
    }
}

